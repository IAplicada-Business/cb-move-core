import * as React from "react";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";

import type { AuthContext } from "@/components/ui/auth-switch";
import { cn } from "@/lib/utils";

const COPY: Record<
  AuthContext,
  {
    title: string;
    subtitle: string;
    footnote: string;
    colaboradorLabel: string;
    pacienteLabel: string;
  }
> = {
  admin: {
    title: "Entrar na equipe",
    subtitle: "Fisioterapeutas, secretaria e administração",
    footnote: "",
    colaboradorLabel: "Colaborador",
    pacienteLabel: "Paciente",
  },
  paciente: {
    title: "Portal do paciente",
    subtitle: "Acompanhe relatórios, documentos e evolução do tratamento",
    footnote: "Primeiro acesso? Use a senha informada pela administração.",
    colaboradorLabel: "Colaborador",
    pacienteLabel: "Paciente",
  },
};

type LoginSignInCardProps = {
  accessType: AuthContext;
  onAccessTypeChange: (value: AuthContext) => void;
  email: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  resetLoading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onForgotPassword: () => void;
};

function LoginBrandMark() {
  return (
    <div className="mx-auto flex flex-col items-center gap-2.5">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.8 }}
        className="cb-pin-halo grid h-14 w-14 place-items-center rounded-full p-[2px] shadow-[0_0_24px_rgba(63,181,188,0.35)]"
      >
        <div className="grid h-full w-full place-items-center rounded-full bg-white text-cb-cyan-600">
          <span className="text-2xl font-bold leading-none">∞</span>
        </div>
      </motion.div>
      <div className="text-center leading-tight">
        <p className="text-base font-extrabold tracking-wide text-white">CB MOVE</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cb-cyan-200">
          Neuroscience
        </p>
      </div>
    </div>
  );
}

function AccessTypeSwitch({
  value,
  onChange,
  labels,
}: {
  value: AuthContext;
  onChange: (value: AuthContext) => void;
  labels: { colaborador: string; paciente: string };
}) {
  return (
    <div
      className="relative flex rounded-xl border border-white/[0.08] bg-white/[0.04] p-1"
      role="tablist"
      aria-label="Tipo de acesso"
    >
      <motion.div
        layout
        className="absolute inset-y-1 rounded-lg bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        style={{
          width: "calc(50% - 4px)",
          left: value === "admin" ? "4px" : "calc(50% + 0px)",
        }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
      />
      {(
        [
          { id: "admin" as const, label: labels.colaborador },
          { id: "paciente" as const, label: labels.paciente },
        ] as const
      ).map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            "relative z-10 flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium tracking-wide transition-colors",
            value === item.id ? "text-white" : "text-white/45 hover:text-white/65",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function LoginInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-lg border border-transparent bg-white/[0.06] px-3 py-1 text-sm text-white shadow-xs outline-none transition-[color,box-shadow,background] placeholder:text-white/35",
        "focus-visible:border-cb-cyan-400/40 focus-visible:bg-white/[0.1] focus-visible:ring-[3px] focus-visible:ring-cb-cyan-400/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function LoginSignInCard({
  accessType,
  onAccessTypeChange,
  email,
  password,
  showPassword,
  loading,
  resetLoading,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onSubmit,
  onForgotPassword,
}: LoginSignInCardProps) {
  const copy = COPY[accessType];
  const [focusedInput, setFocusedInput] = React.useState<"email" | "password" | null>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [8, -8]);
  const rotateY = useTransform(mouseX, [-300, 300], [-8, 8]);

  function handleMouseMove(event: React.MouseEvent) {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set(event.clientX - rect.left - rect.width / 2);
    mouseY.set(event.clientY - rect.top - rect.height / 2);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#061418]">
      <div className="absolute inset-0 bg-gradient-to-b from-cb-cyan-900/80 via-[#0c3540]/90 to-[#061418]" />

      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      <div className="absolute top-0 left-1/2 h-[55vh] w-[120vh] -translate-x-1/2 rounded-b-[50%] bg-cb-cyan-600/15 blur-[80px]" />
      <motion.div
        className="absolute top-0 left-1/2 h-[50vh] w-[100vh] -translate-x-1/2 rounded-b-full bg-cb-cyan-400/10 blur-[60px]"
        animate={{ opacity: [0.12, 0.28, 0.12], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 8, repeat: Infinity, repeatType: "mirror" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/2 h-[80vh] w-[90vh] -translate-x-1/2 rounded-t-full bg-cb-purple/15 blur-[70px]"
        animate={{ opacity: [0.2, 0.38, 0.2], scale: [1, 1.08, 1] }}
        transition={{ duration: 7, repeat: Infinity, repeatType: "mirror", delay: 1 }}
      />
      <div className="absolute top-1/4 left-1/4 h-80 w-80 animate-pulse rounded-full bg-cb-cyan-400/5 blur-[100px] opacity-50" />
      <div className="absolute right-1/4 bottom-1/4 h-80 w-80 animate-pulse rounded-full bg-cb-magenta/5 blur-[100px] opacity-40 delay-1000" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-sm px-4"
        style={{ perspective: 1500 }}
      >
        <motion.div
          className="relative"
          style={{ rotateX, rotateY }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          whileHover={{ z: 10 }}
        >
          <div className="group relative">
            <motion.div
              className="absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-700 group-hover:opacity-70"
              animate={{
                boxShadow: [
                  "0 0 12px 2px rgba(63,181,188,0.08)",
                  "0 0 20px 6px rgba(63,181,188,0.14)",
                  "0 0 12px 2px rgba(63,181,188,0.08)",
                ],
                opacity: [0.25, 0.45, 0.25],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
                repeatType: "mirror",
              }}
            />

            <div className="absolute -inset-px overflow-hidden rounded-2xl">
              {[
                {
                  className: "top-0 left-0 h-[2px] w-[50%]",
                  anim: { left: ["-50%", "100%"] },
                  delay: 0,
                },
                {
                  className: "top-0 right-0 h-[50%] w-[2px]",
                  anim: { top: ["-50%", "100%"] },
                  delay: 0.6,
                },
                {
                  className: "bottom-0 right-0 h-[2px] w-[50%]",
                  anim: { right: ["-50%", "100%"] },
                  delay: 1.2,
                },
                {
                  className: "bottom-0 left-0 h-[50%] w-[2px]",
                  anim: { bottom: ["-50%", "100%"] },
                  delay: 1.8,
                },
              ].map((beam) => (
                <motion.div
                  key={beam.className}
                  className={cn(
                    "absolute bg-gradient-to-r from-transparent via-cb-cyan-300/70 to-transparent opacity-60",
                    beam.className,
                  )}
                  animate={{
                    ...beam.anim,
                    opacity: [0.25, 0.65, 0.25],
                  }}
                  transition={{
                    ...(Object.keys(beam.anim)[0] === "left"
                      ? {
                          left: {
                            duration: 2.5,
                            ease: "easeInOut",
                            repeat: Infinity,
                            repeatDelay: 1,
                          },
                        }
                      : Object.keys(beam.anim)[0] === "top"
                        ? {
                            top: {
                              duration: 2.5,
                              ease: "easeInOut",
                              repeat: Infinity,
                              repeatDelay: 1,
                              delay: beam.delay,
                            },
                          }
                        : Object.keys(beam.anim)[0] === "right"
                          ? {
                              right: {
                                duration: 2.5,
                                ease: "easeInOut",
                                repeat: Infinity,
                                repeatDelay: 1,
                                delay: beam.delay,
                              },
                            }
                          : {
                              bottom: {
                                duration: 2.5,
                                ease: "easeInOut",
                                repeat: Infinity,
                                repeatDelay: 1,
                                delay: beam.delay,
                              },
                            }),
                    opacity: {
                      duration: 1.2,
                      repeat: Infinity,
                      repeatType: "mirror",
                      delay: beam.delay,
                    },
                  }}
                />
              ))}
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black/45 p-6 shadow-2xl backdrop-blur-xl">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)",
                  backgroundSize: "30px 30px",
                }}
              />
              <div
                className="cb-rainbow-strip absolute inset-x-0 top-0 h-[2px] opacity-80"
                aria-hidden
              />

              <div className="relative space-y-4">
                <LoginBrandMark />

                <div className="space-y-3 pt-1">
                  <AccessTypeSwitch
                    value={accessType}
                    onChange={onAccessTypeChange}
                    labels={{
                      colaborador: copy.colaboradorLabel,
                      paciente: copy.pacienteLabel,
                    }}
                  />

                  <div className="space-y-1 text-center">
                    <motion.h1
                      key={copy.title}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-lg font-bold text-white"
                    >
                      {copy.title}
                    </motion.h1>
                    <motion.p
                      key={copy.subtitle}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-white/55"
                    >
                      {copy.subtitle}
                    </motion.p>
                  </div>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-3">
                    <motion.div
                      className={cn("relative", focusedInput === "email" && "z-10")}
                      whileHover={{ scale: 1.01 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <div className="relative flex items-center overflow-hidden rounded-lg">
                        <Mail
                          className={cn(
                            "pointer-events-none absolute left-3 h-4 w-4 transition-colors",
                            focusedInput === "email" ? "text-cb-cyan-300" : "text-white/35",
                          )}
                        />
                        <LoginInput
                          id="email"
                          type="email"
                          autoComplete="email"
                          placeholder="E-mail"
                          aria-label="E-mail"
                          value={email}
                          onChange={(e) => onEmailChange(e.target.value)}
                          onFocus={() => setFocusedInput("email")}
                          onBlur={() => setFocusedInput(null)}
                          required
                          className="pl-10"
                        />
                      </div>
                    </motion.div>

                    <motion.div
                      className={cn("relative", focusedInput === "password" && "z-10")}
                      whileHover={{ scale: 1.01 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <div className="relative flex items-center overflow-hidden rounded-lg">
                        <Lock
                          className={cn(
                            "pointer-events-none absolute left-3 h-4 w-4 transition-colors",
                            focusedInput === "password" ? "text-cb-cyan-300" : "text-white/35",
                          )}
                        />
                        <LoginInput
                          id="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          placeholder="Senha"
                          aria-label="Senha"
                          value={password}
                          onChange={(e) => onPasswordChange(e.target.value)}
                          onFocus={() => setFocusedInput("password")}
                          onBlur={() => setFocusedInput(null)}
                          required
                          minLength={6}
                          className="pl-10 pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 text-white/40 transition-colors hover:text-white"
                          onClick={onTogglePassword}
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </motion.div>
                  </div>

                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      className="text-xs text-white/50 transition-colors hover:text-cb-cyan-300 disabled:opacity-50"
                      disabled={resetLoading || loading}
                      onClick={onForgotPassword}
                    >
                      {resetLoading ? "Enviando link…" : "Esqueci minha senha"}
                    </button>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="group/button relative mt-1 w-full"
                  >
                    <div className="absolute inset-0 rounded-lg bg-cb-cyan-600/30 opacity-0 blur-lg transition-opacity duration-300 group-hover/button:opacity-80" />
                    <div className="relative flex h-10 items-center justify-center overflow-hidden rounded-lg bg-cb-cyan-600 font-semibold text-white shadow-[0_8px_24px_rgba(63,181,188,0.25)] transition-colors hover:bg-cb-cyan-500">
                      <motion.div
                        className="absolute inset-0 -z-10 bg-gradient-to-r from-white/0 via-white/25 to-white/0"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{
                          duration: 1.5,
                          ease: "easeInOut",
                          repeat: Infinity,
                          repeatDelay: 1,
                        }}
                        style={{ opacity: loading ? 1 : 0, transition: "opacity 0.3s ease" }}
                      />
                      <AnimatePresence mode="wait">
                        {loading ? (
                          <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                          </motion.div>
                        ) : (
                          <motion.span
                            key="label"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-1.5 text-sm"
                          >
                            Entrar
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/button:translate-x-0.5" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.button>

                  {copy.footnote ? (
                    <p className="text-center text-[11px] leading-relaxed text-white/45">
                      {copy.footnote}
                    </p>
                  ) : null}
                </form>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
