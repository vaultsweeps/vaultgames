import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { createProviderAccount, getProviderAccount, resetProviderPassword, getProviderTransactions, transferFunds, getAllProviderAccounts } from '../controllers/providerController'

const router = Router()

router.use(authenticate)

router.post('/create-account', createProviderAccount)
router.get('/account', getProviderAccount)
router.post('/reset-password', resetProviderPassword)
router.get('/transactions', getProviderTransactions)
router.post('/transfer', transferFunds)
router.get('/accounts', getAllProviderAccounts)

export default router
