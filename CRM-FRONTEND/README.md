# CRM Frontend Application

A comprehensive web application for case management and verification services built with React, TypeScript, and modern web technologies.

## 🚀 Features

- **Authentication & Authorization**: Secure login with role-based access control
- **Dashboard**: Real-time analytics and case management overview
- **Case Management**: Complete CRUD operations for verification cases
- **Client Management**: Client information and relationship management
- **Form Viewer**: Dynamic form rendering and submission handling
- **Real-time Features**: WebSocket integration for live updates
- **Security & UX**: Comprehensive error handling, loading states, and responsive design
- **Dark Mode**: Full theme support with system preference detection
- **Testing**: Comprehensive unit and E2E testing suite

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Radix UI components
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Forms**: React Hook Form with Zod validation
- **Testing**: Vitest, Testing Library, Cypress
- **Build Tool**: Vite
- **Package Manager**: npm

## 📋 Prerequisites

- Node.js 18+
- npm 9+
- Modern web browser with ES2020+ support

## 🚀 Getting Started

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd CRM-FRONTEND
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_APP_VERSION=1.0.0
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## 🧪 Testing

### Unit Tests

Run unit tests with Vitest:
```bash
npm run test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

### E2E Tests

Run Cypress tests:
```bash
npm run test:e2e
```

Open Cypress Test Runner:
```bash
npm run test:e2e:open
```

### Component Tests

Run component tests with Cypress:
```bash
npm run test:component
```

## 📁 Project Structure

```
CRM-FRONTEND/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── ui/            # Base UI components
│   │   ├── forms/         # Form-specific components
│   │   ├── layout/        # Layout components
│   │   └── realtime/      # Real-time features
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility libraries
│   ├── pages/             # Page components
│   ├── services/          # API services
│   ├── test/              # Test utilities
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── cypress/               # E2E tests
├── docs/                  # Documentation
└── ...config files
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000` |
| `VITE_WS_URL` | WebSocket URL | `ws://localhost:3000` |
| `VITE_APP_VERSION` | Application version | `1.0.0` |

### Vite Configuration

The project uses Vite for building and development. Key configurations:

- **Path Aliases**: `@/` maps to `src/`
- **Plugins**: React, TypeScript, ESLint
- **Build**: Optimized for modern browsers

### Tailwind CSS

Custom theme configuration in `tailwind.config.js`:
- Custom color palette
- Dark mode support
- Responsive breakpoints
- Component-specific utilities

## 🎨 UI Components

The application uses a custom component library built on Radix UI:

### Base Components
- `Button` - Various styles and sizes
- `Input` - Form inputs with validation
- `Card` - Content containers
- `Dialog` - Modal dialogs
- `Table` - Data tables with sorting/filtering

### Loading Components
- `LoadingSpinner` - Various spinner styles
- `LoadingOverlay` - Overlay loading states
- `LoadingSkeleton` - Skeleton placeholders
- `LoadingButton` - Buttons with loading states

### Form Components
- `FormViewer` - Dynamic form rendering
- `FormFieldViewer` - Individual field rendering
- `FormAttachmentsViewer` - File attachments
- `FormLocationViewer` - GPS location display

## 🔐 Security Features

### Input Validation
- XSS protection with HTML sanitization
- SQL injection prevention
- URL validation and sanitization
- Password strength validation

### Authentication
- JWT token management
- Automatic token refresh
- Role-based access control
- Session management

### Error Handling
- Global error boundary
- Comprehensive error logging
- User-friendly error messages
- Retry mechanisms

## 📱 Responsive Design

The application is fully responsive with:
- Mobile-first design approach
- Breakpoint-specific layouts
- Touch-friendly interactions
- Optimized performance on all devices

### Breakpoints
- `xs`: 0px - 639px (Mobile)
- `sm`: 640px - 767px (Large Mobile)
- `md`: 768px - 1023px (Tablet)
- `lg`: 1024px - 1279px (Desktop)
- `xl`: 1280px - 1535px (Large Desktop)
- `2xl`: 1536px+ (Extra Large)

## 🌙 Theme System

### Theme Options
- **Light**: Default light theme
- **Dark**: Dark theme for low-light environments
- **System**: Automatically follows system preference

### Theme Persistence
- Themes are saved to localStorage
- Automatic system preference detection
- Smooth theme transitions

## 🔄 Real-time Features

### WebSocket Integration
- Live case updates
- Real-time notifications
- Connection status monitoring
- Automatic reconnection

### Notification System
- Toast notifications
- In-app notification center
- Email/SMS integration (backend)
- Push notifications (PWA ready)

## 📊 Performance

### Optimization Techniques
- Code splitting with React.lazy
- Image optimization
- Bundle size monitoring
- Performance monitoring

### Metrics
- Lighthouse score: 95+
- First Contentful Paint: <1.5s
- Largest Contentful Paint: <2.5s
- Cumulative Layout Shift: <0.1

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Serving the production build locally
You can use any static file server to serve the `dist/` folder after building. Example with `serve`:
```bash
npm install -g serve
npm run build
serve -s dist -l 3001
# Open http://localhost:3001
```

### Environment-specific Builds
```bash
# Staging
npm run build:staging

# Production
npm run build:production
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes
4. Add tests for new functionality
5. Run the test suite: `npm run test`
6. Commit your changes: `git commit -m 'Add new feature'`
7. Push to the branch: `git push origin feature/new-feature`
8. Submit a pull request

### Code Style

- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for code formatting
- Write tests for new components/functions
- Follow conventional commit messages

## 📚 Documentation

- [API Documentation](./docs/api.md)
- [Component Library](./docs/components.md)
- [Testing Guide](./docs/testing.md)
- [Deployment Guide](./docs/deployment.md)

## 🐛 Troubleshooting

### Common Issues

1. **Build Errors**: Clear node_modules and reinstall
2. **Test Failures**: Check environment variables
3. **Performance Issues**: Enable React DevTools Profiler

### Getting Help

- Check the [FAQ](./docs/faq.md)
- Search existing [Issues](https://github.com/your-repo/issues)
- Create a new issue with detailed information

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- React team for the amazing framework
- Radix UI for accessible components
- Tailwind CSS for utility-first styling
- All contributors and maintainers
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
