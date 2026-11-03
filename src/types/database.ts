export type Role = 'member' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: Role;
  created_at: string;
}

export interface MembershipPackage {
  id: string;
  name: string;
  price_kobo: number;
  duration_days: number;
  description: string;
  benefits: string[];
  is_active: boolean;
  sort_order: number;
}

export interface Membership {
  id: string;
  user_id: string;
  package_id: string;
  status: 'active' | 'cancelled';
  starts_at: string;
  expires_at: string;
  duration_days: number;
  created_at: string;
}

export interface MembershipWithPackage extends Membership {
  membership_packages: { name: string } | null;
}

export interface Wallet {
  user_id: string;
  balance_kobo: number;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  reward_kobo: number;
  is_active: boolean;
  created_at: string;
}

export type EarningStatus = 'pending' | 'approved' | 'rejected';

export interface Earning {
  id: string;
  user_id: string;
  task_id: string | null;
  amount_kobo: number;
  status: EarningStatus;
  created_at: string;
}
