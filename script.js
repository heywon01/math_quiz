document.addEventListener('DOMContentLoaded', () => {
    // ===== 상태 관리 (State Management) =====
    let users = [];
    let problems = [];
    let currentUser = null;
    // 관리자 전용 정보
    const ADMIN_ID = '1234aa';
    const ADMIN_PASSWORD = 'wj211@';

    // 로컬 스토리지에서 데이터 로드
    const loadData = () => {
        try {
            const storedUsers = localStorage.getItem('users');
            const storedProblems = localStorage.getItem('problems');
            if (storedUsers) {
                users = JSON.parse(storedUsers);
            }
            // 기존 관리자 계정은 users 배열에 없어도 인증 모달에서만 사용됨
            // 하지만 기존 사용자 데이터의 연속성을 위해 초기 관리자 계정 유무 로직은 유지
            if (!users.some(u => u.id === ADMIN_ID)) {
                 users.push({ id: ADMIN_ID, password: ADMIN_PASSWORD, name: '관리자', isAdmin: true });
            }
            if (storedProblems) {
                problems = JSON.parse(storedProblems);
            }
        } catch (e) {
            console.error("Failed to load data from localStorage", e);
            users = [{ id: ADMIN_ID, password: ADMIN_PASSWORD, name: '관리자', isAdmin: true }];
            problems = [];
        }
        // 관리자 계정은 항상 users 배열에 있도록 보장
        if (!users.find(u => u.id === ADMIN_ID)) {
             users.push({ id: ADMIN_ID, password: ADMIN_PASSWORD, name: '관리자', isAdmin: true });
             saveData();
        }
    };
    
    // 로컬 스토리지에 데이터 저장
    const saveData = () => {
        try {
            localStorage.setItem('users', JSON.stringify(users.filter(u => u.id !== ADMIN_ID || u.isAdmin))); // 관리자 계정은 저장 시점에 user.isAdmin: true인 상태로 저장되도록
            localStorage.setItem('problems', JSON.stringify(problems));
        } catch (e) {
            console.error("Failed to save data to localStorage", e);
        }
    };

    // 초기 데이터 로드
    loadData();

    // ===== DOM 요소 선택 =====
    const screens = {
        // **[수정]** 이름 입력 화면 추가
        nameInput: document.getElementById('name-input-screen'),
        // 기존 로그인/회원가입 화면은 hidden 처리
        login: document.getElementById('login-screen'), 
        signup: document.getElementById('signup-screen'),
        main: document.getElementById('main-app-screen'),
    };
    const mainViews = {
        problems: document.getElementById('problem-view'),
        users: document.getElementById('user-list-view'),
        addProblem: document.getElementById('add-problem-view'),
        account: document.getElementById('account-view'),
    };
    // **[추가]** 이름 입력 폼
    const nameInputForm = document.getElementById('name-input-form');
    // **[삭제]** loginForm, signupForm 대신 사용
    // const loginForm = document.getElementById('login-form');
    // const signupForm = document.getElementById('signup-form');
    
    const problemModal = document.getElementById('problem-modal');
    const addProblemForm = document.getElementById('add-problem-form');
    const accountEditForm = document.getElementById('account-edit-form');
    // **[추가]** 관리자 인증 모달
    const adminAuthModal = document.getElementById('admin-auth-modal');
    const adminAuthForm = document.getElementById('admin-auth-form');
    
    const customModal = {
        overlay: document.getElementById('custom-modal-overlay'),
        message: document.getElementById('custom-modal-message'),
        okBtn: document.getElementById('custom-modal-ok'),
        cancelBtn: document.getElementById('custom-modal-cancel'),
    };

    // ===== 유틸리티 함수 =====
    // showCustomAlert, showCustomConfirm, readFileAsDataURL 함수는 기존과 동일하게 유지

    const showCustomAlert = (message) => {
        return new Promise((resolve) => {
            customModal.message.textContent = message;
            customModal.cancelBtn.classList.add('hidden');
            customModal.overlay.classList.remove('hidden');

            const okListener = () => {
                customModal.overlay.classList.add('hidden');
                customModal.okBtn.removeEventListener('click', okListener);
                resolve();
            };
            customModal.okBtn.addEventListener('click', okListener);
        });
    };

    const showCustomConfirm = (message) => {
        return new Promise((resolve) => {
            customModal.message.textContent = message;
            customModal.cancelBtn.classList.remove('hidden');
            customModal.overlay.classList.remove('hidden');
            
            const okListener = () => {
                customModal.overlay.classList.add('hidden');
                cleanup();
                resolve(true);
            };

            const cancelListener = () => {
                customModal.overlay.classList.add('hidden');
                cleanup();
                resolve(false);
            };
            
            const cleanup = () => {
                customModal.okBtn.removeEventListener('click', okListener);
                customModal.cancelBtn.removeEventListener('click', cancelListener);
            }
            
            customModal.okBtn.addEventListener('click', okListener);
            customModal.cancelBtn.addEventListener('click', cancelListener);
        });
    };
    
    const readFileAsDataURL = (file) => {
        return new Promise((resolve, reject) => {
            if (!file) {
                resolve("");
                return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // ===== 화면 전환 함수 =====
    const showScreen = (screenName) => {
        Object.values(screens).forEach(screen => screen.classList.add('hidden'));
        screens[screenName].classList.remove('hidden');
    };
    
    const showMainView = (viewName) => {
        Object.values(mainViews).forEach(view => view.classList.add('hidden'));
        mainViews[viewName].classList.remove('hidden');
    };
    
    // **[추가]** 관리자 화면 요소 표시/숨김
    const updateAdminUI = () => {
        const adminButton = document.getElementById('nav-add-problem');
        const adminAuthButton = document.getElementById('nav-admin-auth');
        
        if (currentUser && currentUser.isAdmin) {
            adminButton.classList.remove('hidden');
            adminAuthButton.classList.add('hidden'); // 관리자면 인증 버튼 숨김
        } else {
            adminButton.classList.add('hidden');
            adminAuthButton.classList.remove('hidden'); // 일반 사용자면 인증 버튼 표시
        }
    };

    // ===== 렌더링 함수 =====
    // renderProblems, renderUsers, renderCalendar 함수는 기존과 동일하게 유지

    const renderProblems = (filterDate = null) => {
        const container = document.getElementById('problem-cards-container');
        container.innerHTML = '';
        
        const problemsToRender = filterDate 
            ? problems.filter(p => p.date === filterDate)
            : problems;

        if (problemsToRender.length === 0 && !filterDate) {
             container.innerHTML = `<p class="text-gray-500 col-span-full text-center">아직 등록된 문제가 없습니다.</p>`;
             return;
        }
        if (problemsToRender.length === 0 && filterDate) {
             container.innerHTML = `<p class="text-gray-500 col-span-full text-center">${filterDate}에 등록된 문제가 없습니다.</p>`;
             return;
        }

        problemsToRender.sort((a, b) => b.id - a.id).forEach(problem => {
            const card = document.createElement('div');
            card.className = 'relative bg-gray-50 p-6 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer';
            card.dataset.problemId = problem.id;
            
            let contentHTML = '';
            if (problem.question.text) {
                contentHTML += `<p class="text-lg font-semibold truncate">${problem.question.text}</p>`;
            }
            if (problem.question.image) {
                contentHTML += `<img src="${problem.question.image}" alt="문제 이미지" class="mt-2 rounded-lg max-h-40 w-full object-cover">`;
            }
            
            let adminControls = '';
            if (currentUser && currentUser.isAdmin) {
                adminControls = `
                    <button class="delete-problem-btn absolute top-2 right-2 text-red-500 hover:text-red-700 p-1 bg-white bg-opacity-70 rounded-full" data-problem-id="${problem.id}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" />
                        </svg>
                    </button>
                `;
            }

            card.innerHTML = `
                ${contentHTML}
                <div class="text-sm text-gray-500 mt-4 flex justify-between items-center">
                    <span>ID: ${problem.id}</span>
                    <span>푼 사람: ${problem.solvers.length}명</span>
                </div>
                ${adminControls}
            `;
            card.addEventListener('click', (e) => {
                if (e.target.closest('.delete-problem-btn')) return;
                openProblemModal(problem.id)
            });
            container.appendChild(card);
        });
    };

    const renderUsers = () => {
        const container = document.getElementById('user-list-container');
        container.innerHTML = '';
        users.filter(u => !u.isAdmin).forEach(user => { // 관리자(1234aa)는 명단에 표시하지 않음
            const li = document.createElement('li');
            li.className = 'bg-gray-50 p-4 rounded-lg flex justify-between items-center';
            li.innerHTML = `
                <div>
                    <span class="font-semibold">${user.name}</span>
                    <span class="text-gray-500 text-sm ml-2">(${user.id})</span>
                </div>
                ${user.isAdmin ? '<span class="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">관리자</span>' : ''}
            `;
            container.appendChild(li);
        });
    };
    
    const renderCalendar = (year, month) => {
         const container = document.getElementById('calendar-container');
         container.innerHTML = '';
         const calendarProblemsDisplay = document.getElementById('calendar-problems-display');
         calendarProblemsDisplay.innerHTML = '';
         
         const date = new Date(year, month);
         
         const header = document.createElement('div');
         header.className = 'flex justify-between items-center mb-4';
         header.innerHTML = `
            <button id="prev-month" class="p-2 rounded-full hover:bg-gray-200">&lt;</button>
            <h4 class="text-xl font-bold">${year}년 ${month + 1}월</h4>
            <button id="next-month" class="p-2 rounded-full hover:bg-gray-200">&gt;</button>
         `;
         container.appendChild(header);
         
         document.getElementById('prev-month').addEventListener('click', () => renderCalendar(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1));
         document.getElementById('next-month').addEventListener('click', () => renderCalendar(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1));

         const table = document.createElement('table');
         table.className = 'w-full text-center';
         table.innerHTML = `
            <thead>
                <tr>
                    ${['일', '월', '화', '수', '목', '금', '토'].map(day => `<th class="py-2 text-sm text-gray-500">${day}</th>`).join('')}
                </tr>
            </thead>
            <tbody></tbody>
         `;
         container.appendChild(table);

         const tbody = table.querySelector('tbody');
         const firstDay = new Date(year, month, 1).getDay();
         const lastDate = new Date(year, month + 1, 0).getDate();
         
         let dateNum = 1;
         for (let i = 0; i < 6; i++) {
            const row = document.createElement('tr');
            for (let j = 0; j < 7; j++) {
                const cell = document.createElement('td');
                cell.className = 'p-1';
                if (i === 0 && j < firstDay) {
                    // pass
                } else if (dateNum > lastDate) {
                    // pass
                } else {
                    const cellDate = new Date(year, month, dateNum);
                    // 날짜가 하루씩 밀리는 문제 해결
                    const dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
                    const hasProblem = problems.some(p => p.date === dateStr);
                    
                    cell.innerHTML = `
                        <button data-date="${dateStr}" class="w-10 h-10 rounded-full transition-colors duration-200 flex items-center justify-center ${hasProblem ? 'bg-indigo-200 text-indigo-800 font-bold hover:bg-indigo-300' : 'hover:bg-gray-200'}">
                            ${dateNum}
                        </button>
                    `;
                    dateNum++;
                }
                row.appendChild(cell);
            }
            tbody.appendChild(row);
            if (dateNum > lastDate) break;
         }
         
         tbody.querySelectorAll('button[data-date]').forEach(button => {
            button.addEventListener('click', (e) => {
                const selectedDate = e.currentTarget.dataset.date;
                const problemsForDate = problems.filter(p => p.date === selectedDate);
                
                calendarProblemsDisplay.innerHTML = `<h4 class="text-lg font-bold mt-4 mb-2">${selectedDate}의 문제</h4>`;
                if (problemsForDate.length > 0) {
                    const list = document.createElement('ul');
                    list.className = 'space-y-2';
                    problemsForDate.forEach(p => {
                       const li = document.createElement('li');
                       li.className = 'p-3 bg-gray-100 rounded-md cursor-pointer hover:bg-gray-200';
                       li.textContent = p.question.text || '이미지 문제';
                       li.addEventListener('click', () => openProblemModal(p.id));
                       list.appendChild(li);
                    });
                    calendarProblemsDisplay.appendChild(list);
                } else {
                    calendarProblemsDisplay.innerHTML += `<p class="text-gray-500">이 날짜에는 문제가 없습니다.</p>`;
                }
            });
         });
    };


    // ===== 이벤트 핸들러 =====

    // **[추가]** 이름 입력 처리 (기존 로그인/회원가입 대체)
    nameInputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('user-name').value.trim();

        if (name.length < 1) {
            showCustomAlert('이름을 입력해주세요.');
            return;
        }

        // 간단한 사용자 ID 생성 (현재 시간 기반)
        const id = 'user' + Date.now(); 
        
        currentUser = { id, password: '', name, isAdmin: false };

        // 기존 사용자인지 확인 (이름으로)
        let existingUser = users.find(u => u.name === name && !u.isAdmin);
        if (existingUser) {
            // 이미 있는 이름이면 해당 사용자 정보로 업데이트하고 사용
            currentUser = existingUser;
        } else {
            // 새 사용자면 추가
            users.push(currentUser);
            saveData();
        }

        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        document.getElementById('user-name-display').textContent = currentUser.name;
        updateAdminUI(); // 관리자 UI 업데이트
        showScreen('main');
        showMainView('problems');
        const today = new Date();
        renderProblems();
        renderCalendar(today.getFullYear(), today.getMonth());
        nameInputForm.reset();
    });

    // 로그아웃 처리
    document.getElementById('logout-button').addEventListener('click', () => {
        currentUser = null;
        localStorage.removeItem('currentUser');
        showScreen('nameInput'); // 로그아웃 후 이름 입력 화면으로 이동
    });

    // **[추가]** 관리자 인증 버튼 이벤트 리스너
    document.getElementById('nav-admin-auth').addEventListener('click', () => {
        adminAuthModal.classList.remove('hidden');
        document.getElementById('admin-auth-error').classList.add('hidden');
        adminAuthForm.reset();
    });
    
    // **[추가]** 관리자 인증 취소 버튼 이벤트 리스너
    document.getElementById('cancel-admin-auth').addEventListener('click', () => {
        adminAuthModal.classList.add('hidden');
    });

    // **[추가]** 관리자 인증 폼 제출 처리
    adminAuthForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('admin-id').value;
        const password = document.getElementById('admin-password').value;
        const errorMsg = document.getElementById('admin-auth-error');

        if (id === ADMIN_ID && password === ADMIN_PASSWORD) {
            // 인증 성공
            adminAuthModal.classList.add('hidden');
            
            // 현재 사용자를 관리자로 업데이트
            currentUser.isAdmin = true;
            
            // users 배열에 있는 현재 사용자 정보도 업데이트
            const userInDb = users.find(u => u.id === currentUser.id && u.name === currentUser.name && !u.isAdmin);
            if(userInDb) {
                 userInDb.isAdmin = true;
            } 
            
            saveData(); 
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            updateAdminUI(); // 관리자 UI (문제 추가 버튼) 표시
            await showCustomAlert('관리자 인증이 완료되었습니다.');
            renderProblems(); // 문제 목록 새로고침 (삭제 버튼 표시)

        } else {
            // 인증 실패
            errorMsg.classList.remove('hidden');
        }
    });


    // 네비게이션
    document.getElementById('nav-problems').addEventListener('click', () => {
        showMainView('problems');
        renderProblems();
        const today = new Date();
        renderCalendar(today.getFullYear(), today.getMonth());
    });
    document.getElementById('nav-users').addEventListener('click', () => {
        showMainView('users');
        renderUsers();
    });
    document.getElementById('nav-add-problem').addEventListener('click', () => {
        if (!currentUser || !currentUser.isAdmin) {
             showCustomAlert('관리자만 접근 가능합니다.');
             return;
        }
        showMainView('addProblem');
        resetAddProblemForm();
    });
    document.getElementById('nav-edit-account').addEventListener('click', () => {
        showMainView('account');
        document.getElementById('edit-name').value = currentUser.name;
    });

    // 계정 정보 수정
    accountEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = document.getElementById('edit-name').value;
        
        // 관리자 ID로 로그인한 경우를 제외하고 이름 변경
        const userInDb = users.find(u => u.id === currentUser.id && !u.isAdmin);
        if(userInDb) {
            userInDb.name = newName;
            currentUser.name = newName;
            document.getElementById('user-name-display').textContent = currentUser.name;
            saveData(); // 계정 정보 변경 후 데이터 저장
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            await showCustomAlert('이름이 변경되었습니다.');
            showMainView('problems');
        } else if (currentUser.isAdmin && currentUser.id === ADMIN_ID) {
            await showCustomAlert('관리자 계정의 이름은 변경할 수 없습니다.');
            document.getElementById('edit-name').value = currentUser.name; // 원복
        } else {
             await showCustomAlert('사용자 정보를 찾을 수 없습니다.');
        }
    });
    document.getElementById('cancel-edit-account').addEventListener('click', () => showMainView('problems'));

    // 문제 삭제 처리 (이벤트 위임)
    document.getElementById('problem-cards-container').addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-problem-btn');
        if (deleteBtn) {
            e.stopPropagation();
            if (!currentUser || !currentUser.isAdmin) {
                 await showCustomAlert('관리자만 문제를 삭제할 수 있습니다.');
                 return;
            }
            const problemId = parseInt(deleteBtn.dataset.problemId, 10);
            const confirmed = await showCustomConfirm('문제를 삭제하시겠습니까?');
            
            if (confirmed) {
                const problemIndex = problems.findIndex(p => p.id === problemId);
                if (problemIndex > -1) {
                    problems.splice(problemIndex, 1);
                    saveData(); // 문제 삭제 후 데이터 저장
                    renderProblems();
                    await showCustomAlert('문제가 삭제되었습니다.');
                }
            }
        }
    });

    // 문제 추가 로직
    const optionsContainer = document.getElementById('options-container');
    const addOptionBtn = document.getElementById('add-option-btn');
    let optionCount = 0;

    const createOptionInput = (isFirst = false) => {
        optionCount++;
        const div = document.createElement('div');
        div.className = 'flex items-start space-x-2 p-3 bg-gray-50 rounded-lg';
        div.innerHTML = `
            <input type="radio" name="correct-option" value="${optionCount}" class="form-radio h-5 w-5 text-indigo-600 mt-2" required>
            <div class="flex-grow space-y-2">
                <input type="text" class="option-text w-full border border-gray-300 rounded-md p-2" placeholder="선택지 내용 (글)">
                <input type="file" class="option-image-upload w-full text-sm text-gray-500 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer">
                <img class="option-image-preview hidden mt-1 rounded max-h-24" alt="선택지 이미지 미리보기">
            </div>
            ${!isFirst ? `<button type="button" class="remove-option-btn text-red-500 hover:text-red-700 p-1 mt-1">&times;</button>` : ''}
        `;
        optionsContainer.appendChild(div);
        
        div.querySelector('.remove-option-btn')?.addEventListener('click', () => div.remove());

        const fileInput = div.querySelector('.option-image-upload');
        const preview = div.querySelector('.option-image-preview');
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.src = e.target.result;
                    preview.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            } else {
                preview.src = '';
                preview.classList.add('hidden');
            }
        });
    };
    
    const resetAddProblemForm = () => {
        addProblemForm.reset();
        document.getElementById('problem-image-preview').classList.add('hidden');
        optionsContainer.innerHTML = '<label class="block text-sm font-medium text-gray-700">객관식 선택지 (정답을 선택하세요)</label>';
        optionCount = 0;
        for(let i=0; i<4; i++) createOptionInput(i === 0);
        optionsContainer.querySelector('input[type="radio"]').checked = true;
    }

    addOptionBtn.addEventListener('click', () => createOptionInput());

    document.getElementById('problem-image-upload').addEventListener('change', (event) => {
        const file = event.target.files[0];
        const preview = document.getElementById('problem-image-preview');
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            preview.src = '';
            preview.classList.add('hidden');
        }
    });

    addProblemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser || !currentUser.isAdmin) {
             await showCustomAlert('문제 추가는 관리자만 가능합니다.');
             return;
        }

        document.getElementById('loading-overlay').classList.remove('hidden');

        try {
            const questionText = document.getElementById('problem-text').value;
            const questionImageFile = document.getElementById('problem-image-upload').files[0];

            if (!questionText && !questionImageFile) {
                throw new Error('문제 내용 또는 이미지를 입력해야 합니다.');
            }

            const questionImage = await readFileAsDataURL(questionImageFile);
            
            const validOptionDivs = Array.from(optionsContainer.querySelectorAll('.flex.items-start')).filter(div => {
                // 1. 옵셔널 체이닝을 사용하여 안전하게 .value에 접근합니다.
                const text = div.querySelector('.option-text')?.value || ''; 

                // 2. 파일 입력은 .files[0]으로 그대로 접근합니다. (이 요소가 null일 가능성은 적음)
                const imageFile = div.querySelector('.option-image-upload')?.files[0];

                return text || imageFile;
            });

            if (validOptionDivs.length < 2) {
                throw new Error('유효한 선택지는 최소 2개 이상이어야 합니다.');
            }

            const optionPromises = validOptionDivs.map(div => {
                const text = div.querySelector('.option-text').value;
                const imageFile = div.querySelector('.option-image-upload').files[0];
                return readFileAsDataURL(imageFile).then(image => ({ text, image }));
            });

            const resolvedOptions = await Promise.all(optionPromises);

            const correctRadio = addProblemForm.querySelector('input[name="correct-option"]:checked');
            if (!correctRadio) {
                throw new Error('정답을 선택해주세요.');
            }
            const correctDiv = correctRadio.closest('.flex.items-start');
            const correctIndex = validOptionDivs.indexOf(correctDiv);

            if (correctIndex === -1) {
                throw new Error('선택된 정답이 유효한 선택지가 아닙니다.');
            }
            resolvedOptions.forEach((opt, index) => {
                opt.isCorrect = (index === correctIndex);
            });

            const newProblem = {
                id: problems.length > 0 ? Math.max(...problems.map(p => p.id)) + 1 : 1,
                date: document.getElementById('problem-date').value || new Date().toISOString().split('T')[0],
                question: { text: questionText, image: questionImage },
                options: resolvedOptions,
                solvers: []
            };

            problems.push(newProblem);
            saveData(); // 문제 추가 후 데이터 저장
            showCustomAlert('문제 추가 완료');
            showMainView('problems');
            renderProblems();
        } catch (error) {
            await showCustomAlert(error.message || '문제 추가 중 오류 발생');
        } finally {
            document.getElementById('loading-overlay').classList.add('hidden');
        }
    });

    document.getElementById('cancel-add-problem').addEventListener('click', () => showMainView('problems'));

    // 문제 풀이 모달 로직 (openProblemModal, handleAnswer, updateSolverInfo 등은 기존과 동일하게 유지)
    const openProblemModal = (problemId) => {
        const problem = problems.find(p => p.id === problemId);
        if (!problem) return;

        problemModal.dataset.currentProblemId = problemId;

        const contentDiv = document.getElementById('modal-problem-content');
        contentDiv.innerHTML = '';
        if (problem.question.text) {
            contentDiv.innerHTML += `<p class="text-xl">${problem.question.text}</p>`;
        }
        if (problem.question.image) {
            contentDiv.innerHTML += `<img src="${problem.question.image}" alt="문제 이미지" class="mt-4 rounded-lg max-w-full mx-auto">`;
        }

        const optionsContainer = document.getElementById('modal-options-container');
        optionsContainer.innerHTML = '';
        problem.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'block w-full text-left p-4 border rounded-lg hover:bg-gray-100 transition';
            
            let optionContent = '';
             if (option.text) {
                optionContent += `<span class="font-medium">${index + 1}. ${option.text}</span>`;
            }
            if (option.image) {
                optionContent += `<img src="${option.image}" alt="선택지 이미지" class="mt-2 rounded-lg max-h-32">`;
            }
            button.innerHTML = optionContent;

            // 사용자가 이미 풀었는지 확인
            const alreadySolved = problem.solvers.some(s => s.userId === currentUser.id);
            if (alreadySolved) {
                button.disabled = true;
                button.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                button.addEventListener('click', () => handleAnswer(problemId, index));
            }

            optionsContainer.appendChild(button);
        });

        document.getElementById('modal-feedback').innerHTML = '';
        updateSolverInfo(problem);
        problemModal.classList.remove('hidden');
    };

    const handleAnswer = (problemId, selectedIndex) => {
        const problem = problems.find(p => p.id === problemId);
        const isCorrect = problem.options[selectedIndex].isCorrect;
        const feedbackDiv = document.getElementById('modal-feedback');
        
        if (isCorrect) {
            feedbackDiv.textContent = '정답';
            feedbackDiv.className = 'mt-4 text-center font-bold text-green-600';
        } else {
            feedbackDiv.textContent = '오답';
            feedbackDiv.className = 'mt-4 text-center font-bold text-red-600';
        }
        
        if (!problem.solvers.some(s => s.userId === currentUser.id)) {
            // 정답 여부와 함께 사용자 정보를 solvers 배열에 추가
            problem.solvers.push({ userId: currentUser.id, name: currentUser.name, isCorrect: isCorrect }); 
            saveData(); // 문제 풀이 후 데이터 저장
        }
        
        updateSolverInfo(problem);
        renderProblems();
        
        // 문제 풀이 후 버튼 비활성화
        document.querySelectorAll('#modal-options-container button').forEach(btn => {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        });
    };

    const updateSolverInfo = (problem) => {
         document.getElementById('solver-count').textContent = `푼 사람: ${problem.solvers.length}명`;
         const solversListUl = document.querySelector('#modal-solvers-list ul');
         solversListUl.innerHTML = '';
         if (problem.solvers.length > 0) {
             problem.solvers.forEach(solver => {
                 const li = document.createElement('li');
                 const resultText = solver.isCorrect 
                     ? `<span class="text-green-600 font-semibold">(⭕)</span>` 
                     : `<span class="text-red-600 font-semibold">(❌)</span>`;

                 li.innerHTML = `${solver.name} ${resultText}`;
                 solversListUl.appendChild(li);
             });
         } else {
             solversListUl.innerHTML = '<li>아직 아무도 풀지 않았습니다.</li>';
         }
    };

    document.getElementById('close-modal-btn').addEventListener('click', () => {
        problemModal.classList.add('hidden');
    });

    const showSolversBtn = document.getElementById('show-solvers-btn');
    const solversList = document.getElementById('modal-solvers-list');
    showSolversBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        solversList.classList.toggle('hidden');
    });
    document.body.addEventListener('click', () => solversList.classList.add('hidden'));


    // ===== 초기화 =====
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        document.getElementById('user-name-display').textContent = currentUser.name;
        
        updateAdminUI(); // 관리자 UI 업데이트

        showScreen('main');
        showMainView('problems');
        renderProblems();
        const today = new Date();
        renderCalendar(today.getFullYear(), today.getMonth());
    } else {
        showScreen('nameInput');
    }
}); // <-- 파일의 모든 코드가 끝나면 반드시 닫아주어야 합니다.