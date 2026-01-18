import apiClient from './client';
import { Menu, MenuListResponse } from '../types';

export const getMenus = async (includeInactive = false): Promise<MenuListResponse> => {
  const response = await apiClient.get('/menus', {
    params: { include_inactive: includeInactive },
  });
  return response.data;
};

export const createMenu = async (data: {
  name: string;
  price: number;
}): Promise<Menu> => {
  const response = await apiClient.post('/menus', data);
  return response.data;
};

export const getMenu = async (id: string): Promise<Menu> => {
  const response = await apiClient.get(`/menus/${id}`);
  return response.data;
};

export const updateMenu = async (
  id: string,
  data: Partial<{
    name: string;
    price: number;
    is_active: boolean;
    display_order: number;
  }>
): Promise<Menu> => {
  const response = await apiClient.put(`/menus/${id}`, data);
  return response.data;
};

export const deleteMenu = async (id: string): Promise<void> => {
  await apiClient.delete(`/menus/${id}`);
};

export const reorderMenus = async (menuIds: string[]): Promise<{ message: string }> => {
  const response = await apiClient.put('/menus/reorder', { menu_ids: menuIds });
  return response.data;
};
