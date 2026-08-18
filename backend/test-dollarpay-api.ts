const { DollarPayService } = require('./src/services/payment/DollarPayService');

async function test() {
  try {
    console.log('Testing createPayInOrder API...');
    const result = await DollarPayService.createPayInOrder(
      19.99,
      'DEP-123456',
      'testuser',
      '127.0.0.1',
      'dev-device',
      'dollarpay'
    );
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

test();
