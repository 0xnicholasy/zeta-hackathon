import React from 'react';
import type { RouteObject } from 'react-router-dom';

// Lazy load components to avoid circular dependencies
const LandingPage = React.lazy(() => import('../pages/LandingPage'));
const DashBoardPage = React.lazy(() => import('../pages/DashBoardPage'));
const NotFoundPage = React.lazy(() => import('../pages/NotFoundPage'));

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