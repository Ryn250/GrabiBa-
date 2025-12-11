/* login.js */
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        if(!username || !password){
            alert('Please enter both username and password.');
            return;
        }

        const success = APP.login(username, password);
        if(success){
            window.location.href = 'dashboard.html';
        }
    });
});
