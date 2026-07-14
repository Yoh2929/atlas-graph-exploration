import api from "./axios";
import type { User } from "../types";


export async function login(email: string, password: string) {
  const form = new URLSearchParams();

  form.set("username", email);
  form.set("password", password);


  const { data } = await api.post(
    "/api/auth/login",
    form,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );


  return data as {
    access_token: string;
    token_type: string;
  };
}



export async function register(
  email: string,
  password: string,
  display_name?: string
) {
  const { data } = await api.post("/api/auth/register", {
    email,
    password,
    display_name,
  });


  return data as User;
}



export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>("/api/auth/me");

  return data;
}

export async function logout(): Promise<void> {
  await api.post("/api/auth/logout");
}

export async function updateProfile(display_name: string): Promise<User> {
  const { data } = await api.patch<User>("/api/auth/me", { display_name });
  return data;
}

export async function changePassword(current_password: string, new_password: string): Promise<void> {
  await api.post("/api/auth/change-password", { current_password, new_password });
}
