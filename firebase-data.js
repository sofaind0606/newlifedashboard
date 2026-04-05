// firebase-data.js - Общий модуль для сохранения данных
// ✅ ИСПРАВЛЕНО: без export, с .catch(), localStorage first, не блокирует UI

// ============ FIREBASE CONFIG ============
const firebaseConfig = {
    apiKey: "AIzaSyARKWwV3cggOhda9g6cDNcEAGOpUN4O63I",
    authDomain: "lifedashbord.firebaseapp.com",
    projectId: "lifedashbord",
    storageBucket: "lifedashbord.appspot.com",  // ✅ ИСПРАВЛЕНО: было .firebasestorage.app
    messagingSenderId: "206574362724",
    appId: "1:206574362724:web:83887cae4dc87b41137f71"
};

// ============ GLOBALS ============
let auth = null, db = null, currentUser = null;
let dataLoaded = false;

// ============ INIT ============
// ✅ Убран export - функция глобальная
async function initFirebase() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK not loaded');
        return false;
    }

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    auth = firebase.auth();
    db = firebase.firestore();

    return new Promise((resolve) => {
        auth.onAuthStateChanged(async (user) => {
            currentUser = user;
            if (user) {
                console.log('✅ Firebase initialized, user:', user.email);
                // ✅ ЗАГРУЗКА ИЗ FIREBASE В ФОНЕ - не блокирует рендер UI
                loadAllData(user.uid).catch(function() {});
                dataLoaded = true;
            } else {
                console.log('🔓 No user - using localStorage only');
                loadFromLocalStorage();
            }
            resolve(!!user);
        });
    });
}

// ============ LOAD ALL DATA ============
async function loadAllData(uid) {
    try {
        // ✅ Все вызовы с .catch() чтобы ошибки не ломали приложение
        await Promise.all([
            loadTasks(uid).catch(function() {}),
            loadHabits(uid).catch(function() {}),
            loadMedia(uid).catch(function() {}),
            loadStudyTasks(uid).catch(function() {}),
            loadPomodoroSessions(uid).catch(function() {}),
            loadSleepLogs(uid).catch(function() {}),
            loadYearGoals(uid).catch(function() {}),
            loadMonthPlans(uid).catch(function() {})
        ]);
        saveToLocalStorage();
        console.log('✅ All data loaded from Firestore');
    } catch (e) {
        console.error('❌ Load error:', e);
        loadFromLocalStorage();
    }
}

// ============ TASKS ============
async function loadTasks(uid) {
    // ✅ Сначала загружаем из localStorage (мгновенно)
    window.allTasks = JSON.parse(localStorage.getItem('allTasks')) || {};
    
    if (db && currentUser) {
        try {
            const snap = await db.collection('users').doc(uid).collection('tasks').get();
            if (!snap.empty) {
                const loaded = {};
                snap.forEach(doc => { loaded[doc.id] = doc.data(); });
                // Только если данные отличаются - обновляем
                if (JSON.stringify(window.allTasks) !== JSON.stringify(loaded)) {
                    window.allTasks = loaded;
                    localStorage.setItem('allTasks', JSON.stringify(window.allTasks));
                    console.log('☁️ Tasks synced from Firebase');
                }
            }
        } catch (e) {
            console.log('⚠️ Using localStorage for tasks');
        }
    }
}

async function saveTasks(uid, dateKey, tasks) {
    // ✅ Сначала сохраняем в localStorage (мгновенно)
    window.allTasks = window.allTasks || {};
    window.allTasks[dateKey] = { tasks: tasks };
    localStorage.setItem('allTasks', JSON.stringify(window.allTasks));
    
    // ✅ Потом в фоне отправляем в Firebase
    if (db && currentUser) {
        try {
            await db.collection('users').doc(uid).collection('tasks').doc(dateKey)
                .set({ tasks: tasks }, { merge: true }).catch(function() {});
        } catch (e) {
            console.log('⚠️ Firebase save failed, using localStorage');
        }
    }
}

async function deleteTask(uid, dateKey, taskIdx) {
    if (!window.allTasks[dateKey]?.tasks?.[taskIdx]) return;
    
    // ✅ Локальное удаление
    window.allTasks[dateKey].tasks.splice(taskIdx, 1);
    localStorage.setItem('allTasks', JSON.stringify(window.allTasks));
    
    // ✅ Firebase в фоне
    if (db && currentUser) {
        try {
            const ref = db.collection('users').doc(uid).collection('tasks').doc(dateKey);
            if (window.allTasks[dateKey].tasks.length === 0) {
                await ref.delete().catch(function() {});
            } else {
                await ref.set({ tasks: window.allTasks[dateKey].tasks }).catch(function() {});
            }
        } catch (e) {
            console.log('⚠️ Firebase delete failed');
        }
    }
}

// ============ HABITS ============
async function loadHabits(uid) {
    // ✅ Сначала из localStorage
    window.habits = JSON.parse(localStorage.getItem('habitsList')) || [];
    window.habitCompletions = JSON.parse(localStorage.getItem('habitCompletions')) || {};
    
    if (db && currentUser) {
        try {
            const habitsSnap = await db.collection('users').doc(uid).collection('habits').get();
            if (!habitsSnap.empty) {
                const loaded = [];
                habitsSnap.forEach(doc => { loaded.push({ id: doc.id, ...doc.data() }); });
                if (JSON.stringify(window.habits) !== JSON.stringify(loaded)) {
                    window.habits = loaded;
                    localStorage.setItem('habitsList', JSON.stringify(window.habits));
                }
            }
            
            const compSnap = await db.collection('users').doc(uid).collection('habitCompletions').get();
            if (!compSnap.empty) {
                const loaded = {};
                compSnap.forEach(doc => { loaded[doc.id] = doc.data().completed; });
                if (JSON.stringify(window.habitCompletions) !== JSON.stringify(loaded)) {
                    window.habitCompletions = loaded;
                    localStorage.setItem('habitCompletions', JSON.stringify(window.habitCompletions));
                }
            }
        } catch (e) {
            console.log('⚠️ Using localStorage for habits');
        }
    }
}

async function addHabit(uid, name, icon = '🎯', days = [0,1,2,3,4,5,6]) {
    const id = 'habit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    const habit = { id, name, icon, days };
    
    // ✅ Локально
    window.habits = window.habits || [];
    window.habits.push(habit);
    localStorage.setItem('habitsList', JSON.stringify(window.habits));
    
    // ✅ Firebase в фоне
    if (db && currentUser) {
        try {
            await db.collection('users').doc(uid).collection('habits').doc(id).set(habit).catch(function() {});
        } catch (e) {}
    }
    return id;
}

async function deleteHabit(uid, habitId) {
    // ✅ Локально
    window.habits = (window.habits || []).filter(h => h.id !== habitId);
    localStorage.setItem('habitsList', JSON.stringify(window.habits));
    
    // ✅ Firebase в фоне
    if (db && currentUser) {
        try {
            await db.collection('users').doc(uid).collection('habits').doc(habitId).delete().catch(function() {});
            const compSnap = await db.collection('users').doc(uid).collection('habitCompletions')
                .where('habitId', '==', habitId).get();
            const batch = db.batch();
            compSnap.forEach(doc => batch.delete(doc.ref));
            await batch.commit().catch(function() {});
        } catch (e) {}
    }
}

async function toggleHabitCompletion(uid, habitId, date, completed) {
    const key = habitId + '_' + date;
    
    // ✅ Локально
    window.habitCompletions = window.habitCompletions || {};
    if (completed) {
        window.habitCompletions[key] = true;
    } else {
        delete window.habitCompletions[key];
    }
    localStorage.setItem('habitCompletions', JSON.stringify(window.habitCompletions));
    
    // ✅ Firebase в фоне
    if (db && currentUser) {
        try {
            const ref = db.collection('users').doc(uid).collection('habitCompletions').doc(key);
            if (completed) {
                await ref.set({ habitId: habitId, completed: true, date: date }).catch(function() {});
            } else {
                await ref.delete().catch(function() {});
            }
        } catch (e) {}
    }
}

// ============ MEDIA (Books/Movies/Series) ============
async function loadMedia(uid) {
    // ✅ Сначала из localStorage
    window.books = JSON.parse(localStorage.getItem('booksData')) || [];
    window.movies = JSON.parse(localStorage.getItem('moviesData')) || [];
    window.series = JSON.parse(localStorage.getItem('seriesData')) || [];
    
    if (db && currentUser) {
        try {
            const snap = await db.collection('users').doc(uid).collection('media').doc('lists').get();
            if (snap.exists) {
                const data = snap.data();
                const newBooks = data.books || [];
                const newMovies = data.movies || [];
                const newSeries = data.series || [];
                
                if (JSON.stringify(window.books) !== JSON.stringify(newBooks)) {
                    window.books = newBooks;
                    localStorage.setItem('booksData', JSON.stringify(window.books));
                }
                if (JSON.stringify(window.movies) !== JSON.stringify(newMovies)) {
                    window.movies = newMovies;
                    localStorage.setItem('moviesData', JSON.stringify(window.movies));
                }
                if (JSON.stringify(window.series) !== JSON.stringify(newSeries)) {
                    window.series = newSeries;
                    localStorage.setItem('seriesData', JSON.stringify(window.series));
                }
            }
        } catch (e) {
            console.log('⚠️ Using localStorage for media');
        }
    }
}

async function saveMedia(uid, type, items) {
    // ✅ Локально
    window[type] = items;
    localStorage.setItem(type + 'Data', JSON.stringify(items));
    
    // ✅ Firebase в фоне
    if (db && currentUser) {
        try {
            const current = await db.collection('users').doc(uid).collection('media').doc('lists').get();
            const data = current.exists ? current.data() : {};
            await db.collection('users').doc(uid).collection('media').doc('lists')
                .set({ ...data, [type]: items }, { merge: true }).catch(function() {});
        } catch (e) {}
    }
}

// ============ STUDY TASKS ============
async function loadStudyTasks(uid) {
    // ✅ Сначала из localStorage
    window.studySubjects = JSON.parse(localStorage.getItem('studySubjects')) || [];
    
    if (db && currentUser) {
        try {
            const snap = await db.collection('users').doc(uid).collection('study').doc('subjects').get();
            if (snap.exists) {
                const loaded = snap.data().subjects || [];
                if (JSON.stringify(window.studySubjects) !== JSON.stringify(loaded)) {
                    window.studySubjects = loaded;
                    localStorage.setItem('studySubjects', JSON.stringify(window.studySubjects));
                }
            }
        } catch (e) {
            console.log('⚠️ Using localStorage for study');
        }
    }
}

async function saveStudySubjects(uid, subjects) {
    // ✅ Локально
    window.studySubjects = subjects;
    localStorage.setItem('studySubjects', JSON.stringify(subjects));
    
    // ✅ Firebase в фоне
    if (db && currentUser) {
        try {
            await db.collection('users').doc(uid).collection('study').doc('subjects')
                .set({ subjects: subjects }, { merge: true }).catch(function() {});
        } catch (e) {}
    }
}

// ============ POMODORO ============
async function loadPomodoroSessions(uid) {
    // ✅ Сначала из localStorage
    window.pomodoroSessions = JSON.parse(localStorage.getItem('pomodoroSessions')) || [];
    
    if (db && currentUser) {
        try {
            const snap = await db.collection('users').doc(uid).collection('pomodoro').doc('sessions').get();
            if (snap.exists) {
                const loaded = snap.data().sessions || [];
                if (JSON.stringify(window.pomodoroSessions) !== JSON.stringify(loaded)) {
                    window.pomodoroSessions = loaded.slice(0, 100);
                    localStorage.setItem('pomodoroSessions', JSON.stringify(window.pomodoroSessions));
                }
            }
        } catch (e) {
            console.log('⚠️ Using localStorage for pomodoro');
        }
    }
}

async function savePomodoroSessions(uid, sessions) {
    // ✅ Локально
    window.pomodoroSessions = sessions.slice(0, 100);
    localStorage.setItem('pomodoroSessions', JSON.stringify(window.pomodoroSessions));
    
    // ✅ Firebase в фоне
    if (db && currentUser) {
        try {
            await db.collection('users').doc(uid).collection('pomodoro').doc('sessions')
                .set({ sessions: window.pomodoroSessions }, { merge: true }).catch(function() {});
        } catch (e) {}
    }
}

// ============ SLEEP TRACKER ============
async function loadSleepLogs(uid) {
    // ✅ Сначала из localStorage
    window.sleepLogs = JSON.parse(localStorage.getItem('sleepLogs')) || [];
    
    if (db && currentUser) {
        try {
            const snap = await db.collection('users').doc(uid).collection('sleep').doc('logs').get();
            if (snap.exists) {
                const loaded = snap.data().logs || [];
                if (JSON.stringify(window.sleepLogs) !== JSON.stringify(loaded)) {
                    window.sleepLogs = loaded.slice(0, 100);
                    localStorage.setItem('sleepLogs', JSON.stringify(window.sleepLogs));
                }
            }
        } catch (e) {
            console.log('⚠️ Using localStorage for sleep');
        }
    }
}

async function saveSleepLogs(uid, logs) {
    // ✅ Локально
    window.sleepLogs = logs.slice(0, 100);
    localStorage.setItem('sleepLogs', JSON.stringify(window.sleepLogs));
    
    // ✅ Firebase в фоне
    if (db && currentUser) {
        try {
            await db.collection('users').doc(uid).collection('sleep').doc('logs')
                .set({ logs: window.sleepLogs }, { merge: true }).catch(function() {});
        } catch (e) {}
    }
}

// ============ YEAR GOALS ============
async function loadYearGoals(uid) {
    // ✅ Сначала из localStorage
    window.yearGoals = JSON.parse(localStorage.getItem('yearGoalsData')) || [];
    
    if (db && currentUser) {
        try {
            const snap = await db.collection('users').doc(uid).collection('year').doc('goals').get();
            if (snap.exists) {
                const loaded = snap.data().goals || [];
                if (JSON.stringify(window.yearGoals) !== JSON.stringify(loaded)) {
                    window.yearGoals = loaded;
                    localStorage.setItem('yearGoalsData', JSON.stringify(window.yearGoals));
                }
            }
        } catch (e) {
            console.log('⚠️ Using localStorage for year goals');
        }
    }
}

async function saveYearGoals(uid, goals) {
    // ✅ Локально
    window.yearGoals = goals;
    localStorage.setItem('yearGoalsData', JSON.stringify(goals));
    
    // ✅ Firebase в фоне
    if (db && currentUser) {
        try {
            await db.collection('users').doc(uid).collection('year').doc('goals')
                .set({ goals: goals }, { merge: true }).catch(function() {});
        } catch (e) {}
    }
}

// ============ MONTH PLANS ============
async function loadMonthPlans(uid) {
    // ✅ Сначала из localStorage
    window.monthPlans = JSON.parse(localStorage.getItem('monthPlans')) || [];
    
    if (db && currentUser) {
        try {
            const snap = await db.collection('users').doc(uid).collection('month').doc('plans').get();
            if (snap.exists) {
                const loaded = snap.data().plans || [];
                if (JSON.stringify(window.monthPlans) !== JSON.stringify(loaded)) {
                    window.monthPlans = loaded;
                    localStorage.setItem('monthPlans', JSON.stringify(window.monthPlans));
                }
            }
        } catch (e) {
            console.log('⚠️ Using localStorage for month plans');
        }
    }
}

async function saveMonthPlans(uid, plans) {
    // ✅ Локально
    window.monthPlans = plans;
    localStorage.setItem('monthPlans', JSON.stringify(plans));
    
    // ✅ Firebase в фоне
    if (db && currentUser) {
        try {
            await db.collection('users').doc(uid).collection('month').doc('plans')
                .set({ plans: plans }, { merge: true }).catch(function() {});
        } catch (e) {}
    }
}

// ============ LOCALSTORAGE FALLBACK ============
function loadFromLocalStorage() {
    window.allTasks = JSON.parse(localStorage.getItem('allTasks')) || {};
    window.habits = JSON.parse(localStorage.getItem('habitsList')) || [];
    window.habitCompletions = JSON.parse(localStorage.getItem('habitCompletions')) || {};
    window.books = JSON.parse(localStorage.getItem('booksData')) || [];
    window.movies = JSON.parse(localStorage.getItem('moviesData')) || [];
    window.series = JSON.parse(localStorage.getItem('seriesData')) || [];
    window.studySubjects = JSON.parse(localStorage.getItem('studySubjects')) || [];
    window.pomodoroSessions = JSON.parse(localStorage.getItem('pomodoroSessions')) || [];
    window.sleepLogs = JSON.parse(localStorage.getItem('sleepLogs')) || [];
    window.yearGoals = JSON.parse(localStorage.getItem('yearGoalsData')) || [];
    window.monthPlans = JSON.parse(localStorage.getItem('monthPlans')) || [];
    console.log('💾 Loaded from localStorage');
}

function saveToLocalStorage() {
    localStorage.setItem('allTasks', JSON.stringify(window.allTasks || {}));
    localStorage.setItem('habitsList', JSON.stringify(window.habits || []));
    localStorage.setItem('habitCompletions', JSON.stringify(window.habitCompletions || {}));
    localStorage.setItem('booksData', JSON.stringify(window.books || []));
    localStorage.setItem('moviesData', JSON.stringify(window.movies || []));
    localStorage.setItem('seriesData', JSON.stringify(window.series || []));
    localStorage.setItem('studySubjects', JSON.stringify(window.studySubjects || []));
    localStorage.setItem('pomodoroSessions', JSON.stringify(window.pomodoroSessions || []));
    localStorage.setItem('sleepLogs', JSON.stringify(window.sleepLogs || []));
    localStorage.setItem('yearGoalsData', JSON.stringify(window.yearGoals || []));
    localStorage.setItem('monthPlans', JSON.stringify(window.monthPlans || []));
}

// ============ LOGOUT ============
async function handleLogout() {
    if (auth) await auth.signOut();
    currentUser = null;
    dataLoaded = false;
    console.log('🚪 Logged out');
}

// ============ STATUS ============
function getSyncStatus() {
    return {
        firebaseReady: !!db,
        currentUser: currentUser?.email || null,
        isOnline: navigator.onLine,
        dataLoaded: dataLoaded
    };
}

// ============ GLOBAL EXPORT (без export) ============
window.LifeDashboardData = {
    initFirebase: initFirebase,
    loadAllData: loadAllData,
    saveToLocalStorage: saveToLocalStorage,
    loadFromLocalStorage: loadFromLocalStorage,
    
    loadTasks: loadTasks,
    saveTasks: saveTasks,
    deleteTask: deleteTask,
    
    loadHabits: loadHabits,
    addHabit: addHabit,
    deleteHabit: deleteHabit,
    toggleHabitCompletion: toggleHabitCompletion,
    
    loadMedia: loadMedia,
    saveMedia: saveMedia,
    
    loadStudyTasks: loadStudyTasks,
    saveStudySubjects: saveStudySubjects,
    
    loadPomodoroSessions: loadPomodoroSessions,
    savePomodoroSessions: savePomodoroSessions,
    
    loadSleepLogs: loadSleepLogs,
    saveSleepLogs: saveSleepLogs,
    
    loadYearGoals: loadYearGoals,
    saveYearGoals: saveYearGoals,
    
    loadMonthPlans: loadMonthPlans,
    saveMonthPlans: saveMonthPlans,
    
    handleLogout: handleLogout,
    getSyncStatus: getSyncStatus,
    
    get auth() { return auth; },
    get db() { return db; },
    get currentUser() { return currentUser; },
    get isLoaded() { return dataLoaded; }
};