import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

async function test() {
  try {
    const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, 'changeme_dev_secret', { expiresIn: '1h' });
    const res = await fetch('http://localhost:5000/api/dashboard/overview', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Status code:', res.status);
    console.log(await res.text());
  } catch(e) {
    console.error(e);
  }
}
test();
