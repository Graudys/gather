import { z } from "zod";

// Regras de entrada usadas no servidor (Server Actions e rotas).
// Os mesmos limites estão nas restrições do banco (CHECK) e nos campos da tela.
export const LIMITES = { nome: 80, email: 254, senhaMin: 10, senhaMax: 72, mensagem: 4000, workspace: 80 } as const;

export const email = z.email("E-mail inválido.").max(LIMITES.email);
export const senhaNova = z.string().min(LIMITES.senhaMin, "A senha precisa de pelo menos 10 caracteres.").max(LIMITES.senhaMax, "Senha longa demais.");
export const nomePessoa = z.string().trim().min(1, "Diga seu nome.").max(LIMITES.nome);
export const nomeWorkspace = z.string().trim().min(1).max(LIMITES.workspace);
export const textoMensagem = z.string().trim().min(1).max(LIMITES.mensagem);
export const id = z.uuid();
