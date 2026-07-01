import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';

export function MainLayout() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 ml-64 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
