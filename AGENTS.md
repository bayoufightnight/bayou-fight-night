# Agent Instructions for Bayou Fight Night

This document provides instructions for AI agents working on this codebase. Adhering to these guidelines will ensure consistency and quality.

## Build, Lint, and Test Commands

### Build

To build the project, run:

```bash
npm run build
```

This command runs TypeScript compiler and then Vite to build the project.

### Lint

To lint the codebase, run:

```bash
npm run lint
```

This command uses ESLint to check for code quality and style issues.

### Test

There is no pre-configured test command in `package.json`. We recommend using `vitest`, a fast and simple testing framework for Vite projects.

To run a single test file, you would typically use a command like this:

```bash
npx vitest path/to/your/test.spec.ts
```

**Note:** If `vitest` is not installed, please add it to the `devDependencies` in `package.json` and then run `npm install`.

## Code Style Guidelines

### General Principles

*   Maintain a clean and readable codebase.
*   Write self-documenting code. Add comments only for complex logic.
*   Follow existing code patterns and conventions.

### Formatting

*   **Indentation:** Use 2 spaces for indentation.
*   **Semicolons:** Use semicolons at the end of statements.
*   **Line Endings:** Use LF line endings.

### Naming Conventions

*   **Components:** Use PascalCase for React components (e.g., `PlayerCard`, `HealthBar`).
*   **Files:** Use kebab-case for file names (e.g., `player-card.tsx`, `use-player-state.ts`).
*   **Variables and Functions:** Use camelCase for variables and functions (e.g., `playerHealth`, `calculateDamage`).
*   **Types and Interfaces:** Use PascalCase for types and interfaces (e.g., `Player`, `GameState`).

### Imports

*   Organize imports in the following order:
    1.  React and other third-party libraries.
    2.  Internal components and modules.
    3.  CSS and other assets.
*   Use absolute paths for imports from the `src` directory (e.g., `import { MyComponent } from 'src/components/MyComponent'`). `tsconfig.json` should be configured to support this.

### Types

*   Use TypeScript for all new code.
*   Enable `strict` mode in `tsconfig.json` and address any reported errors.
*   Avoid using `any` type. Define explicit types or interfaces.
*   Use interfaces for public APIs and types for internal component props and state.

### Error Handling

*   Use `try...catch` blocks for asynchronous operations that can fail.
*   Handle errors gracefully and provide feedback to the user when appropriate.
*   Do not leave empty `catch` blocks.

### React Best Practices

*   Use functional components with hooks.
*   Use `useState` for simple component state and `useReducer` for more complex state logic.
*   Use `useEffect` for side effects, and be mindful of the dependency array to avoid unnecessary re-renders.
*   Use `useCallback` and `useMemo` to optimize performance when needed.
*   Keep components small and focused on a single responsibility.
*   Use `className` for styling with Tailwind CSS.
*   Use `lucide-react` for icons.

### Firebase

*   Follow Firebase SDK best practices for interacting with Firestore, Authentication, and other services.
*   Keep Firebase configuration in a separate file and do not commit sensitive information to the repository.

### HTML Best Practices

*    Use semantic HTML to improve accessibility.
*   Add `alt` text to all images.
*   Use `aria` attributes where needed.

### CSS Best Practices

*   Use Tailwind CSS for styling.
*   Avoid writing custom CSS files. If you must, use CSS Modules.
*   Use `clsx` or a similar utility to conditionally apply classes.

By following these guidelines, you will help maintain a high-quality and consistent codebase.
