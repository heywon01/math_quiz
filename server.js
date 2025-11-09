// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
// 로컬 개발 환경을 위해 dotenv 사용. 배포 환경(Render 등)에서는 환경 변수가 자동 적용됨.
require('dotenv').config(); 

const app = express();
// PORT는 배포 환경에서 지정하는 환경 변수(예: Render의 PORT)를 사용하고, 로컬에서는 5000을 사용
const PORT = process.env.PORT || 5000; 

// --- 미들웨어 설정 ---
app.use(cors()); 
app.use(express.json()); // JSON 요청 본문 파싱

// --- MongoDB 연결 ---
// MONGODB_URI는 Render, Railway 등의 환경 변수로 설정해야 합니다.
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Atlas에 성공적으로 연결되었습니다.'))
    .catch(err => {
        console.error('❌ MongoDB 연결 오류:', err.message);
        // 연결 실패 시 서버 종료
        process.exit(1); 
    });

// --- 데이터 모델 정의 ---
// 기존 코드를 기반으로 관리자와 사용자 데이터를 서버에서 중앙 관리하도록 모델링

// 사용자 모델 (User)
const UserSchema = new mongoose.Schema({
    userId: { type: String, unique: true, required: true }, 
    name: { type: String, required: true },
    password: { type: String }, 
    isAdmin: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    latestQuizDate: Date
});

// 문제 모델 (Problem)
const ProblemSchema = new mongoose.Schema({
    date: { type: String, unique: true, required: true }, // 'YYYY-MM-DD'
    question: { type: String, required: true },
    answer: { type: Number, required: true },
    solvers: [{ // 퀴즈를 푼 사용자 목록
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: String,
        isCorrect: Boolean,
        solvedAt: Date
    }]
});

const User = mongoose.model('User', UserSchema);
const Problem = mongoose.model('Problem', ProblemSchema);

// --- API 라우터 (Endpoints) ---

// 1. 사용자 로그인/등록 (이름 입력 시)
app.post('/api/users/login', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).send('이름을 입력해주세요.');

    try {
        let user = await User.findOne({ name });

        if (!user) {
            // 새 사용자 등록.
            if (name === '관리자' && req.body.isAdminInit) { 
                // 기존 script.js의 관리자 정보(1234aa, wj211@)를 사용하여 초기 관리자 생성
                user = await User.create({ name, userId: '1234aa', password: 'wj211@', isAdmin: true });
            } else {
                user = await User.create({ name, userId: name + Date.now() });
            }
        }
        
        // 비밀번호 제거 후 사용자 정보 전송
        const { password, ...userData } = user.toObject();
        res.status(200).json(userData);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 2. 관리자 인증
app.post('/api/admin/auth', async (req, res) => {
    const { id, password } = req.body;
    try {
        const user = await User.findOne({ userId: id, password: password, isAdmin: true });
        if (user) {
            const { password, ...userData } = user.toObject();
            return res.json(userData);
        }
        res.status(401).send('인증 실패');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 3. 모든 사용자 명단 조회 (리더보드)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({ isAdmin: false }).sort({ score: -1, latestQuizDate: 1 }).select('-password');
        res.json(users);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 4. 모든 퀴즈 목록 조회
app.get('/api/problems', async (req, res) => {
    try {
        const problems = await Problem.find({}).sort({ date: -1 });
        res.json(problems);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// 5. 새 퀴즈 추가 (관리자 전용)
app.post('/api/problems', async (req, res) => {
    const { date, question, answer } = req.body;
    // 실제로는 관리자 인증 로직(토큰 검증)이 필요합니다.
    if (!date || !question || !answer) return res.status(400).send('모든 필드를 입력해야 합니다.');

    try {
        const newProblem = await Problem.create({ date, question, answer });
        res.status(201).json(newProblem);
    } catch (err) {
        if (err.code === 11000) return res.status(409).send('이미 해당 날짜의 퀴즈가 존재합니다.');
        res.status(500).send(err.message);
    }
});

// 6. 퀴즈 제출 및 점수 업데이트
app.post('/api/problems/:date/solve', async (req, res) => {
    const { date } = req.params;
    const { userId, answer } = req.body;
    
    try {
        const problem = await Problem.findOne({ date });
        // MongoDB ObjectId를 사용해 사용자 조회
        const user = await User.findById(userId); 

        if (!problem || !user) return res.status(404).send('퀴즈 또는 사용자를 찾을 수 없습니다.');
        
        // 이미 푼 사용자인지 확인
        const alreadySolved = problem.solvers.some(s => s.userId.equals(user._id));
        if (alreadySolved) return res.status(400).send('이미 이 퀴즈를 풀었습니다.');

        const isCorrect = problem.answer === parseInt(answer);
        
        // 퀴즈 결과 저장
        problem.solvers.push({
            userId: user._id,
            name: user.name,
            isCorrect,
            solvedAt: new Date()
        });
        await problem.save();

        let scoreChange = 0;
        if (isCorrect) {
            scoreChange = 1;
            user.score += scoreChange;
            user.latestQuizDate = new Date(); // 최종 퀴즈 풀이 시간 업데이트
            await user.save();
        }

        res.json({ success: true, isCorrect, newScore: user.score });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- 정적 파일 호스팅 (Express에서 프론트엔드 제공) ---
// index.html, script.js, style.css 파일이 모두 루트에 있으므로 다음과 같이 설정합니다.
app.use(express.static(path.join(__dirname, '/'))); 

// API 경로를 제외한 모든 요청에 대해 index.html을 제공 (싱글 페이지 앱을 위한 설정)
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        // API 경로는 무시하고 404를 보냄
        return res.status(404).send('API Endpoint Not Found');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 서버가 ${PORT} 포트에서 실행 중입니다.`);
});