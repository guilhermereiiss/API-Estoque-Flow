export interface JwtPayload {
  id: string;
  email: string;
  perfil: string;
  empresa_id: string;
}

declare global {
  namespace Express {
    interface Request {
      usuario?: JwtPayload;
    }
  }
}
