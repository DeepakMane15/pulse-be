import type { Request, Response } from 'express';

export default function notFound(req: Request, res: Response): void {
  res.status(404).json({ message: 'Route not found' });
}
