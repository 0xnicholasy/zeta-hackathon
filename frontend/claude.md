# Frontend Structure and Guidelines

## Project Structure

```
frontend/
├── src/                    # Source files
│   ├── assets/            # Static assets like images
│   ├── components/        # Reusable UI components
│   │   ├── ui/           # Basic UI components
│   │   ├── dashboard/    # Dashboard-specific components
│   │   └── [page-name]/  # Page-specific components
│   ├── config/           # Configuration files
│   ├── contexts/         # React context providers
│   ├── contracts/        # Contract type definitions and deployments
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions and libraries
│   ├── pages/           # Page components
│   ├── providers/       # Web3 and other providers
│   └── types/           # TypeScript type definitions
```

## Do's

1. **Component Organization**
   - Keep components small and focused on a single responsibility
   - Place shared components in the `components/ui` directory
   - Place feature-specific components in their respective feature directories
   - Place page-specific components in `/components/[page-name]` if they are used only in a single page
   - Check `/components` before adding a new one, and use shadcn's components if possible when creating a new one

2. **Page Structure**
   - Ensure all page components in `/pages` end with `Page` (e.g., `LandingPage.tsx`)
   - Limit page components to a maximum of 400 lines
   - Extract reusable or complex parts of a page into `/components/[page-name]`

3. **Type Safety**
   - Always define proper TypeScript interfaces for props
   - Use type definitions from `contracts/types.ts` for blockchain interactions
   - Keep type definitions up-to-date with smart contract changes

4. **State Management**
   - Use React Context for global state management
   - Use Zustand to manage state or fetched data if the data is reused across multiple pages
   - Implement custom hooks for complex state logic
   - Keep state as close to where it's used as possible

5. **Web3 Integration**
   - Use the `useContracts` hook for contract interactions
   - Handle wallet connections through `Web3Providers`
   - Always include proper error handling for blockchain operations

6. **Code Style**
   - Follow the established project structure
   - Use meaningful variable and function names
   - Include JSDoc comments for complex functions
   - Use async/await for promises

7. **Frontend Performance**
   -- Always prevent unnecessary re-renders by using useCallback and useMemo

## Don'ts

1. **Anti-patterns to Avoid**
   - Don't duplicate code - create reusable components instead
   - Don't put business logic in components - use hooks
   - Don't ignore TypeScript errors - fix type issues
   - Don't hardcode contract addresses - use `deployments.ts`
   - Never use `any` for TypeScript types; use `unknown` only when parsing data from external services (e.g., API responses)

2. **Component Guidelines**
   - Don't create overly large components
   - Don't mix presentational and container components
   - Don't use inline styles - use Tailwind classes
   - Don't skip prop-types or TypeScript interfaces
   - Avoid hardcoding Tailwind styles like colors or widths. For example, use `bg-zeta-500`, `w-10` instead of `w-[10px]`

3. **Performance Considerations**
   - Don't make unnecessary re-renders
   - Don't fetch data repeatedly - use caching
   - Don't ignore React hooks dependencies
   - Don't create new objects/functions in render

4. **State Management**
   - Don't use global state when local state is sufficient
   - Don't modify state directly - use state updater functions
   - Don't store derived state - compute it
   - Don't ignore state updates lifecycle

5. **Web3 Best Practices**
   - Don't expose private keys or sensitive data
   - Don't ignore transaction errors
   - Don't forget to handle network changes
   - Don't skip loading and error states

6. **Development Workflow**
   - Never run `bun run dev` or `bun run build` directly in your terminal

7. **UI Guidelines**
   - Don't display emoji texts in the UI
   - Use `react-icons` or `web3-icons` for icons instead

8. **Typescript Practices**
   - Avoid using type `<some type> | null` or `<some type> | undefined` or <some type> | "" where possible
   - Don't use ```as `0x${string}``` in code, reference @frontend/src/components/dashboard/types.ts for better type handling types for EVM addresses and hashes
   

## Development Workflow

1. Create a new branch for each feature
2. Follow TypeScript best practices
3. Test components thoroughly
4. Update documentation as needed
5. Submit PR for review

## Getting Started

1. Install dependencies: `bun install`
2. Run development server: `bun dev`
3. Build for production: `bun build`