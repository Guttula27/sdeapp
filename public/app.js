// 1. Grab HTML elements by their IDs so we can control them
const authSection = document.getElementById('auth-section'); // The login/register container
const dashboardSection = document.getElementById('dashboard-section'); // The logged-in dashboard container
const userNameDisplay = document.getElementById('user-name-display'); // Welcoming text span
const logoutButton = document.getElementById('logout-button'); // The logout button

const loginForm = document.getElementById('login-form'); // Login form
const loginEmail = document.getElementById('login-email'); // Login email box
const loginPassword = document.getElementById('login-password'); // Login password box

const registerForm = document.getElementById('register-form'); // Register form
const registerName = document.getElementById('register-name'); // Register name box
const registerEmail = document.getElementById('register-email'); // Register email box
const registerPassword = document.getElementById('register-password'); // Register password box
const registerRole = document.getElementById('register-role'); // Register role select

const addBookForm = document.getElementById('add-book-form'); // Add book form
const bookTitle = document.getElementById('book-title'); // Book title box
const bookAuthor = document.getElementById('book-author'); // Book author box
const booksList = document.getElementById('books-list'); // Books list container


// 2. State Check: Manages showing/hiding sections on page load
function checkLoginState() {
  const token = localStorage.getItem('token'); // Checks if token exists in browser storage
  const userString = localStorage.getItem('user'); // Checks if user object exists in browser storage

  if (token && userString) {
    const user = JSON.parse(userString); // Parses the stringified user object
    authSection.style.display = 'none'; // Hides the login/register forms
    dashboardSection.style.display = 'block'; // Shows the dashboard options
    userNameDisplay.textContent = `${user.name} (${user.role})`; // Displays active name and role
  } else {
    authSection.style.display = 'block'; // Shows login/register forms
    dashboardSection.style.display = 'none'; // Hides dashboard options
  }

  fetchBooks(); // Automatically load the list of books
}


// 3. User Registration
registerForm.addEventListener('submit', async (event) => {
  event.preventDefault(); // Prevents browser page refresh
  const name = registerName.value; // Reads name input
  const email = registerEmail.value; // Reads email input
  const password = registerPassword.value; // Reads password input
  const role = registerRole.value; // Reads selected role option

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST', // Sends HTTP POST request
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }) // Packs input fields
    });

    const data = await response.json(); // Parses server reply

    if (response.ok) {
      alert('Registration successful! Please log in.'); // Success alert
      registerName.value = ''; registerEmail.value = ''; registerPassword.value = ''; // Clears inputs
    } else {
      alert(data.error || 'Registration failed.'); // Error alert
    }
  } catch (err) {
    console.error(err);
  }
});


// 4. User Login
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault(); // Prevents page refresh
  const email = loginEmail.value; // Reads email input
  const password = loginPassword.value; // Reads password input

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST', // Sends HTTP POST request
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json(); // Parses server reply

    if (response.ok) {
      localStorage.setItem('token', data.token); // Saves JWT token permanently in browser storage
      localStorage.setItem('user', JSON.stringify(data.user)); // Saves basic user info string
      loginEmail.value = ''; loginPassword.value = ''; // Clears input fields
      checkLoginState(); // Updates UI to logged-in dashboard view
    } else {
      alert(data.error || 'Login failed.'); // Error alert
    }
  } catch (err) {
    console.error(err);
  }
});


// 5. User Logout
logoutButton.addEventListener('click', () => {
  localStorage.removeItem('token'); // Clears JWT token from browser storage
  localStorage.removeItem('user'); // Clears user info from browser storage
  checkLoginState(); // Updates UI back to login forms view
});


// 6. Get All Books (Public Route)
async function fetchBooks() {
  try {
    const response = await fetch('/api/books'); // Sends GET request to backend books endpoint
    const data = await response.json();

    if (response.ok) {
      booksList.innerHTML = ''; // Resets screen books list
      
      data.books.forEach(book => {
        const li = document.createElement('li'); // Creates a list element: <li>
        li.textContent = `"${book.title}" by ${book.author} (Added by: ${book.added_by_name || 'System'}) `; // Fills book info
        
        // Authorization check: If logged-in user is an Admin, render a Delete button next to the book
        const userString = localStorage.getItem('user');
        if (userString) {
          const user = JSON.parse(userString);
          if (user.role === 'admin') {
            const deleteBtn = document.createElement('button'); // Creates delete button
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => deleteBook(book.id)); // Calls delete function on click
            li.appendChild(deleteBtn); // Adds delete button inside the list item
          }
        }

        booksList.appendChild(li); // Appends list item to the book list on screen
      });
    }
  } catch (err) {
    console.error(err);
  }
}


// 7. Add a Book (Protected Route)
addBookForm.addEventListener('submit', async (event) => {
  event.preventDefault(); // Prevents page refresh
  const title = bookTitle.value; // Reads book title
  const author = bookAuthor.value; // Reads book author
  const token = localStorage.getItem('token'); // Reads authorization token from storage

  try {
    const response = await fetch('/api/books', {
      method: 'POST', // Sends HTTP POST request
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // Passes the JWT token inside the authorization header!
      },
      body: JSON.stringify({ title, author })
    });

    const data = await response.json();

    if (response.ok) {
      bookTitle.value = ''; bookAuthor.value = ''; // Clears inputs
      fetchBooks(); // Reloads list to display new book
    } else {
      alert(data.error || 'Failed to add book.');
    }
  } catch (err) {
    console.error(err);
  }
});


// 8. Delete a Book (Protected - Admin Only)
async function deleteBook(id) {
  const token = localStorage.getItem('token'); // Reads authorization token from storage

  try {
    const response = await fetch(`/api/books/${id}`, {
      method: 'DELETE', // Sends HTTP DELETE request
      headers: { 'Authorization': `Bearer ${token}` } // Passes JWT token in header
    });

    const data = await response.json();

    if (response.ok) {
      fetchBooks(); // Reloads list to verify deletion
    } else {
      alert(data.error || 'Failed to delete book.');
    }
  } catch (err) {
    console.error(err);
  }
}


// 9. Startup check
checkLoginState();
