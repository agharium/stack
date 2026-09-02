import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import type { PrivateAccount } from "../api";

type Props = {
  user: PrivateAccount;
  onBack: () => void;
  onUpdated: (user: PrivateAccount) => void;
};

export function ProfilePage({ user, onBack, onUpdated }: Props) {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(user.name);
    setUsername(user.username);
  }, [user]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.updateProfile({ name, username });
      onUpdated(result.user);
      setMessage(result.message);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível atualizar o perfil.",
      );
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.changePassword({
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setMessage(result.message);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível alterar a senha.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home-shell min-h-dvh px-4 py-8 text-white">
      <div className="mx-auto max-w-lg">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-bold text-indigo-200 hover:text-white"
        >
          ← Voltar
        </button>
        <h1 className="mt-6 text-4xl font-black">Perfil</h1>

        <form
          onSubmit={saveProfile}
          className="mt-8 space-y-4 rounded-[2rem] border border-white/15 bg-white/10 p-6 backdrop-blur-xl"
        >
          <h2 className="text-lg font-black">Dados públicos e login</h2>
          <label className="block text-sm font-black uppercase tracking-widest text-indigo-200">
            Nome
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field mt-2"
              required
            />
          </label>
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
          <button type="submit" disabled={busy} className="primary-button w-full">
            Salvar perfil
          </button>
        </form>

        <form
          onSubmit={savePassword}
          className="mt-6 space-y-4 rounded-[2rem] border border-white/15 bg-white/10 p-6 backdrop-blur-xl"
        >
          <h2 className="text-lg font-black">Alterar senha</h2>
          <label className="block text-sm font-black uppercase tracking-widest text-indigo-200">
            Senha atual
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="field mt-2"
              autoComplete="current-password"
            />
          </label>
          <label className="block text-sm font-black uppercase tracking-widest text-indigo-200">
            Nova senha
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="field mt-2"
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm font-black uppercase tracking-widest text-indigo-200">
            Confirmar nova senha
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              className="field mt-2"
              autoComplete="new-password"
            />
          </label>
          <button type="submit" disabled={busy} className="secondary-button w-full">
            Alterar senha
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm font-bold text-lime-200">{message}</p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm font-bold text-rose-200">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
