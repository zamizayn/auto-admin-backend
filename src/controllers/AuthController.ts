import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export class AuthController {
  static async register(req: Request, res: Response) {
    const { email, password } = req.body;
    console.log('Registering user. Body:', JSON.stringify(req.body));

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      const user = await User.create(req.body);
      res.status(201).json(user);
    } catch (err: any) {
      console.error('Registration error:', err);
      res.status(400).json({ error: err.message });
    }
  }

  static async login(req: Request, res: Response) {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      const user = await User.findOne({ where: { email } });
      console.log('User found:', user ? `Yes (ID: ${user.id}, hasPassword: ${!!user.password})` : 'No');

      if (!user || !user.comparePassword(password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ user, token });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: err.message });
    }
  }
}
