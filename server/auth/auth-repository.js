import {
  createSession,
  createUser,
  deleteExpiredSessions,
  getSessionById,
  getUserByEmail,
  getUserById,
  revokeSession,
  revokeUserSessions,
  touchSession,
} from '../database.js';

export const authRepository = {
  createUser,
  getUserByEmail,
  getUserById,
  createSession,
  getSessionById,
  touchSession,
  revokeSession,
  revokeUserSessions,
  deleteExpiredSessions,
};
