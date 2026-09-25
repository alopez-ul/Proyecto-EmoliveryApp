import { Router } from 'express'
import { readDb } from '../db.js'

const router = Router()

router.get('/', async (_req, res) => {
  const db = await readDb()
  res.json(db.productos)
})

export default router
