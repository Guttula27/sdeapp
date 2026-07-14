# React / Frontend — Core Notes

This guide explains the fundamentals of React web applications, Vite build tools, state management, and lifecycle hooks using simple, real-world examples.

---

## 1. Project Creation & Tooling (Vite)

To build a modern React app, we use a bundler tool called **Vite**.

| Command | What happens under the hood |
|---|---|
| `npx create-vite frontend --template react` | Downloads the official React + Vite starter template, setting up configurations and configuration folders. |
| `package.json` | The manifest file. `dependencies` lists libraries needed to run the app in production (e.g. React, Redux). `devDependencies` lists tools only needed during local coding (e.g. compilers, linters). |
| `npm install` | Reads `package.json` and downloads all libraries into a folder called `node_modules/` (which is always ignored by Git). |
| `npm run dev` | Reads the `"dev"` script in `package.json` and launches a local development server on `http://localhost:5173` with fast hot-reloading. |

### 💡 Dev Server vs. Production Builds
* **Development (`npm run dev`):** The local dev server parses, links, and serves files dynamically as you save changes. It includes large developer debugging warnings.
* **Production (`npm run build`):** Compiles the source files, removes developer overhead, minifies the code (shrinks spacing/names), and outputs a folder called **`dist/`**.
* **What is `dist/`?** The `dist/` folder contains only static HTML, CSS, and vanilla JavaScript. It does not require Node.js or any build tools to run! You can host it on a basic static storage server (like Netlify, Vercel, S3, or Nginx) and it will load instantly in the user's browser.

---

## 2. Request/Response vs. Frontend Runtime

To understand frontend code, you must shift your mental model away from typical backend architectures:

* **Backend Environment (Express/Django):** 
  ```
  User Request ──> Controller runs ──> DB query ──> HTML/JSON Response ──> Request Forgotten
  ```
  The backend only executes code when a request hits it, then returns a response and forgets about the client.

* **Frontend Runtime (React in Browser):**
  When a user visits your site, the entire compiled JavaScript application is loaded into the browser's memory **once**. Clicks and actions trigger code that is already in memory—**no network requests are made unless you explicitly write them** (using `fetch` or `axios`).

> **Important:** A button's `onClick` handler is just a local JavaScript function. It will not contact your database or server unless that function explicitly sends an HTTP request.

---

## 3. JSX — Mixing HTML and JavaScript

React uses a syntax extension called **JSX**, which allows you to write HTML-like elements inside your JavaScript file:

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button className="btn-primary" onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  );
}
```

* **HTML tags look identical:** `<button>` is not a React invention—it compiles into a standard browser button element.
* **`className` (not `class`):** Because JavaScript has a reserved keyword called `class` (for writing classes), React uses `className` to define CSS classes.
* **CamelCase events:** Standard HTML uses `onclick="func()"`. React wraps these in camelCase (`onClick`) and takes a direct JavaScript reference (a function) instead of a string.
* **How it compiles:** Browsers cannot run JSX directly. During the build phase, Vite transpiles JSX elements into standard nested JavaScript function calls: `React.createElement('button', { className: 'btn-primary' }, ...)`

---

## 4. `useState` — Persistent State

A standard JavaScript function resets all its internal variables every time it is called. Because React re-runs your component function to redraw the screen, standard variables will not survive.

To persist data, we use **`useState`**:

```javascript
const [books, setBooks] = useState([]);
```

* **`useState([])`**: Creates a state variable initialized as an empty array `[]` that React keeps safe across render cycles.
* **Array Destructuring:** Returns two things:
  1. `books`: The current value of the state.
  2. `setBooks`: The updater function.
* **The Rule of State:** Never modify state directly (e.g. `books.push(newBook)`). React has no way of knowing you modified the array. Always use the setter function (`setBooks(newArray)`), because calling the setter is what alerts React to schedule a screen re-draw.

---

## 5. Re-render Mechanics

React redraws screens through **rendering**.

* When you call a state setter (like `setCount(5)`), React schedules a re-render.
* During a re-render, React runs the **entire component function from top to bottom**.
* **The Trap:** Any code placed directly inside the body of your component function (such as an API database fetch) will run on **every single re-render**, which can crash the application or cause infinite request loops.

---

## 6. Async Fetching & Promises

When you query data from an API, the network request takes time to complete. JavaScript handles this asynchronously using **Promises**:

```javascript
fetch('/api/books')
  .then(res => res.json())
  .then(data => setBooks(data.books));
```

* **`fetch()` is non-blocking:** It sends the request to the server and returns a **Promise** (a placeholder for the future data) immediately, allowing the UI to remain responsive.
* **`.then()`**: Translates to: *"Once the server responds and the Promise is resolved, run this function with the result."*
* **Why are there two `.then()` calls?**
  1. The first `fetch()` resolves when the response headers arrive. We must wait for the body to finish downloading and translate it to JSON via `res.json()` (which is also asynchronous).
  2. The second `.then()` runs once the JSON parsing is complete, giving us the final data to write to our state.

---

## 7. `useEffect` — Controlling Code Execution

If you place a `fetch` directly inside your component body, you will create an infinite loop:

```
Component renders ──> runs fetch() ──> calls setBooks() ──> triggers re-render ──> runs fetch() again ──> Infinite Loop!
```

To prevent this, we isolate side-effects (like fetches) inside **`useEffect`**:

```javascript
useEffect(() => {
  fetch('/api/books')
    .then(res => res.json())
    .then(data => setBooks(data.books));
}, []); // The dependency array
```

The second argument (`[]`) is called the **Dependency Array**. It acts as a gatekeeper that tells React when to run the hook:

| Dependency Array | Behavior |
|---|---|
| **`[]` (Empty array)** | Only runs **once** when the component first mounts on the screen. It will never run again, preventing loops. |
| **`[someVariable]`** | Runs on mount, and then runs again **only** if the value of `someVariable` changes. |
| **Omitted (No array)** | Runs after **every single re-render** (almost never used in production). |

---

## Quick Revision Reference

```
useState      ──> Keeps data safe across redraws and updates the screen
re-render     ──> The component function runs from top-to-bottom
fetch         ──> Initiates async network calls, returning a Promise
.then()       ──> Schedules code to run once async data arrives
useEffect     ──> Gated box that restricts code execution frequency
[]            ──> Empty watch-list: runs once on first load only
```
