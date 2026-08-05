const jwt = require('jsonwebtoken');

const secret = process.env.NEXTAUTH_SECRET;
console.log('NEXTAUTH_SECRET length:', secret?.length);

const payload = {
  sub: '381f9267-3fdc-4d5e-adf2-66f70b606167',
  email: 'alexis@productdesign.mx',
  name: 'Alexis',
  role: 'ADMIN',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
};

const token = jwt.sign(payload, secret, { algorithm: 'HS256' });
console.log('JWT Token:', token);
console.log('Cookie format: next-auth.session-token=' + token);
