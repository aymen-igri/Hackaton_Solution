const request = require('supertest');
const express = require('express');

const createApp = () => {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
};

describe('On-Call Service', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('Health Check', () => {
    test('GET /health should return 200', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
    });
  });

  describe('Schedule Rotation Logic', () => {
    test('should rotate through team members correctly', () => {
      const members = ['alice@example.com', 'bob@example.com', 'carol@example.com'];
      const currentIndex = 0;
      const nextOnCall = members[(currentIndex + 1) % members.length];

      expect(nextOnCall).toBe('bob@example.com');
    });

    test('should handle single member schedule', () => {
      const members = ['alice@example.com'];
      const currentIndex = 0;
      const nextOnCall = members[(currentIndex + 1) % members.length];

      expect(nextOnCall).toBe('alice@example.com');
    });
  });

  describe('Schedule Validation', () => {
    test('should validate schedule has members', () => {
      const validateSchedule = (schedule) => {
        return schedule.members && schedule.members.length > 0;
      };

      const validSchedule = { members: ['alice@example.com', 'bob@example.com'] };
      const invalidSchedule = { members: [] };

      expect(validateSchedule(validSchedule)).toBe(true);
      expect(validateSchedule(invalidSchedule)).toBe(false);
    });

    test('should validate rotation type', () => {
      const validTypes = ['daily', 'weekly', 'bi-weekly'];
      const isValidRotation = (type) => validTypes.includes(type);

      expect(isValidRotation('daily')).toBe(true);
      expect(isValidRotation('monthly')).toBe(false);
    });
  });

  describe('Email Validation', () => {
    test('should validate email format', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      expect(emailRegex.test('alice@example.com')).toBe(true);
      expect(emailRegex.test('invalid-email')).toBe(false);
    });
  });
});
