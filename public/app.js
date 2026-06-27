// 1. Grab the empty list element from the HTML page
const booksList = document.getElementById('books-list'); 

// 2. Define a function to load the books from our API
async function loadBooks() {
  const response = await fetch('/api/books'); // 3. Call the GET /api/books API (like clicking send in Postman)
  const data = await response.json(); // 4. Parse the response data into a JavaScript object

  // 5. Loop through every book in the database
  data.books.forEach(book => {
    const li = document.createElement('li'); // 6. Create a temporary HTML list item: <li></li>
    li.textContent = `"${book.title}" by ${book.author}`; // 7. Put the book text inside it
    booksList.appendChild(li); // 8. Stick the list item inside the empty <ul> on your screen
  });
}

// 9. Run the function automatically when the page opens
loadBooks();
