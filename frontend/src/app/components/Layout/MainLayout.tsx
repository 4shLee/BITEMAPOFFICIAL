import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';

export function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#eef3ef]">
      <Sidebar />
      <div className="ml-64 flex-1 overflow-y-auto bg-background">
        <Outlet />
      </div>
    </div>
  );
}
