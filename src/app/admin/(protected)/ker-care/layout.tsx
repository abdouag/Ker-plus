import { CareAdminNav } from '@/components/care/admin/CareAdminNav';

export default function CareAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <CareAdminNav />
      {children}
    </div>
  );
}
