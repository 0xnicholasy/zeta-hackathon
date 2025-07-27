
import React from 'react';
import type { RouteObject } from 'react-router-dom';

// Lazy load components to avoid circular dependencies
const LandingPage = React.lazy(() => import('../pages/LandingPage'));
const DashBoardPage = React.lazy(() => import('../pages/DashBoardPage'));
const DebuggingPage = React.lazy(() => import('../pages/DebuggingPage'));
const NotFoundPage = React.lazy(() => import('../pages/NotFoundPage'));
const AdminPage = React.lazy(() => import('../pages/AdminPage'));
const LiquidationPage = React.lazy(() => import('../pages/LiquidationPage'));

export interface AppRoute {
  path: string;
  name: string;
  element: React.LazyExoticComponent<React.ComponentType<unknown>>;
  isPublic?: boolean;
  description?: string;
}

export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  LIQUIDATION: '/liquidation',
  DEBUGGING: '/debugging',
  ADMIN: '/admin',
  NOT_FOUND: '*',
} as const;

export const appRoutes: AppRoute[] = [
  {
    path: ROUTES.HOME,
    name: 'Home',
    element: LandingPage,
    isPublic: true,
    description: 'Landing page for ZetaLend protocol',
  },
  {
    path: ROUTES.DASHBOARD,
    name: 'Dashboard',
    element: DashBoardPage,
    isPublic: false,
    description: 'Main lending and borrowing interface',
  },
  {
    path: ROUTES.LIQUIDATION,
    name: 'Liquidation',
    element: LiquidationPage,
    isPublic: false,
    description: 'Liquidation dashboard for tracking and liquidating undercollateralized positions',
  },
  {
    path: ROUTES.DEBUGGING,
    name: 'Debugging',
    element: DebuggingPage,
    isPublic: true,
    description: 'Debug page for deployments and spinner components',
  },
  {
    path: ROUTES.ADMIN,
    name: 'Admin',
    element: AdminPage,
    isPublic: true,
    description: 'Admin page for ZetaLend protocol',
  },
  {
    path: ROUTES.NOT_FOUND,
    name: 'Not Found',
    element: NotFoundPage,
    isPublic: true,
    description: 'Fallback page for undefined routes',
  },
];

export const routeObjects: RouteObject[] = appRoutes.map(route => ({
  path: route.path,
  element: React.createElement(React.Suspense,
    { fallback: React.createElement('div', { className: 'flex items-center justify-center min-h-screen' }, 'Loading...') },
    React.createElement(route.element)
  ),
}));

export const getRouteByPath = (path: string): AppRoute | undefined => {
  return appRoutes.find(route => route.path === path);
};

export const getPublicRoutes = (): AppRoute[] => {
  return appRoutes.filter(route => route.isPublic);
};

export const getPrivateRoutes = (): AppRoute[] => {
  return appRoutes.filter(route => !route.isPublic);
};