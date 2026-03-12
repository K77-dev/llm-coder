import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AuthRequest extends Request {
    user?: { id: string; email: string };
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        next();
        return;
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    } catch {
        // Token invalid but optional — continue anyway
    }
    next();
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        next(new AppError(401, 'Authentication required'));
        return;
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
        next();
    } catch {
        next(new AppError(401, 'Invalid or expired token'));
    }
}

export function generateToken(payload: { id: string; email: string }): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
