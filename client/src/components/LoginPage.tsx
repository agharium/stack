import { FormEvent, useState } from "react";
import { api } from "../api";
import type { PrivateAccount } from "../api";

type Props = {
  onSuccess: (user: PrivateAccount) => void;
  onBack: () => void;
  onGoRegister: () => void;
};

export function LoginPage({ onSuccess, onBack, onGoRegister }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api.login({ username, password });
      onSuccess(user);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Usuário ou senha inválidos.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home-shell min-h-dvh px-4 py-8 text-white">
      <div className="mx-auto max-w-md">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-bold text-indigo-200 hover:text-white"
        >
          ← Voltar
        </button>
        <h1 className="mt-6 text-4xl font-black">Entrar</h1>
        <form onSubmit={submit} className="mt-8 space-y-4 rounded-[2rem] border border-white/15 bg-white/10 p-6 backdrop-blur-xl">
          <label className="block text-sm font-black uppercase tracking-widest text-indigo-200">
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="field mt-2"
              autoComplete="username"
              required
            />
          </label>
          <label className="block text-sm font-black uppercase tracking-widest text-indigo-200">
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field mt-2"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p role="alert" className="text-sm font-bold text-rose-200">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="primary-button w-full">
            Entrar
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-indigo-200">
          Não tem conta?{" "}
          <button
            type="button"
            onClick={onGoRegister}
            className="font-bold text-white underline"
          >
            Criar conta
          </button>
        </p>
      </div>
    </main>
  );
}
