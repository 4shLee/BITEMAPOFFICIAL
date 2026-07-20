import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';

export function MainLayout() {
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 });
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.documentElement.classList.add('bitemap-app-shell');
    document.body.classList.add('bitemap-app-shell');

    return () => {
      document.documentElement.classList.remove('bitemap-app-shell');
      document.body.classList.remove('bitemap-app-shell');
    };
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-[#eef3ef]">
      <div className="max-md:hidden">
        <Sidebar />
      </div>
      <div
        ref={contentRef}
        data-primary-scroll-container
        className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background md:ml-64"
      >
        <Outlet />
      </div>
    </div>
  );
}
