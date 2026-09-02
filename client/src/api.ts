export type PrivateAccount = {
  id: string;
  name: string;
  username: string;
};

export type AuthMeResponse =
  | { authenticated: true; user: PrivateAccount }
  | { authenticated: false; user: null };

export type RankingEntry = {
  userId: string;
  name: string;
  totalPoints: number;
  gamesPlayed: number;
  wins: number;
  secondPlaces: number;
  thirdPlaces: number;
  winRate: number;
};

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(
      (body as { error?: string }).error ??
        "Não foi possível concluir essa operação agora.",
    );
  }
  return body;
}

export const api = {
  me(): Promise<AuthMeResponse> {
    return request<AuthMeResponse>("/api/auth/me");
  },

  register(input: {
    name: string;
    username: string;
    password: string;
    confirmPassword: string;
  }): Promise<{ user: PrivateAccount }> {
    return request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  login(input: {
    username: string;
    password: string;
  }): Promise<{ user: PrivateAccount }> {
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  logout(): Promise<{ ok: boolean }> {
    return request("/api/auth/logout", { method: "POST" });
  },

  getProfile(): Promise<{ user: PrivateAccount }> {
    return request("/api/profile");
  },

  updateProfile(input: {
    name?: string;
    username?: string;
  }): Promise<{ user: PrivateAccount; message: string }> {
    return request("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  changePassword(input: {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  }): Promise<{ message: string }> {
    return request("/api/profile/password", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  getRanking(): Promise<{ ranking: RankingEntry[]; error?: string }> {
    return request("/api/ranking");
  },
};
