export interface ApiResponse<T> {
  data: T;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NavItem {
  label: string;
  path: string;
  icon: string;
}
