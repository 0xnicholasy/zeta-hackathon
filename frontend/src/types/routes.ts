import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../config/routes';

export type RouteKey = keyof typeof ROUTES;

export type RoutePath = typeof ROUTES[RouteKey];

export interface NavigationItem {
  label: string;
  path: RoutePath;
  icon?: string;
  isPrivate?: boolean;
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: 'Home',
    path: ROUTES.HOME,
    isPrivate: false,
  },
  {
    label: 'Dashboard',
    path: ROUTES.DASHBOARD,
    isPrivate: true,
  },
  {
    label: 'Liquidation',
    path: ROUTES.LIQUIDATION,
    isPrivate: true,
  },
];

export const useNavigateTo = () => {
  const navigate = useNavigate();

  const navigateTo = (route: RoutePath) => {
    navigate(route);
  };

  return navigateTo;
};