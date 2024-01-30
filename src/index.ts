import express, { Request, Response } from 'express'
import mysql, { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import jwt from 'jsonwebtoken'

const app = express()
app.use(express.json())
const port: number = 5000

const connectionConfig = {
  host: 'localhost',
  user: 'root',
  password: 'Root1234!',
  database: 'excercise'
}

let connection: Connection | undefined

const main = async () => {
  try {
    connection = await mysql.createConnection(connectionConfig)
    console.log('Connected to the database!')
  } catch (error) {
    console.error('Could not connect to the database!', error)
    process.exit(1)
  }
  app.get('/login', async (req: Request, res: Response) => {
    const { email, pwd } = req.body
    try {
      const [userLogin] = await connection!.query('SELECT id, email, role FROM user WHERE email = ? AND pwd = ?', [
        email,
        pwd
      ])
      const userResult = userLogin as RowDataPacket
      if (userResult.length === 1) {
        const user = userResult[0]
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, 'nhatninh2871')
        res.status(200).json({ jwt: token })
      } else {
        res.status(401).json({ message: 'Invalid email or password' })
      }
    } catch (error) {
      console.error('Error executing query!', error)
      res.status(500).send({ message: 'Internal server error' })
    }
  })
  app.get('/class/list', async (req: Request, res: Response) => {
    try {
      const [rows] = await connection!.query('SELECT * FROM class order by id')
      res.status(200).send(rows)
    } catch (error) {
      console.error('Error executing query!', error)
      res.status(500).send({ message: 'Internal server error' })
    }
  })
  app.get('/class/:id', async (req: Request, res: Response) => {
    const id = req.params.id.slice(1)
    try {
      const [rows] = await connection!.query('SELECT id,className FROM class WHERE id = ?', [id])
      res.status(200).send(rows)
    } catch (error) {
      console.error('Error executing query!', error)
      res.status(500).send({ message: 'Internal server error' })
    }
  })
  app.post('/class', async (req: Request, res: Response) => {
    const { className } = req.body
    try {
      const [result] = (await connection!.execute(`INSERT INTO class (className) VALUES (?)`, [className])) as [
        ResultSetHeader,
        unknown[]
      ]
      const id = result.insertId
      res.status(200).send({ id, className })
    } catch (error) {
      console.error('Error executing query!', error)
      res.status(500).send({ message: 'Internal server error' })
    }
  })
  app.put('/class', async (req: Request, res: Response) => {
    const { id, className } = req.body
    try {
      await connection!.execute(`UPDATE class set className = ? WHERE id = ?`, [className, id])
      res.status(200).send({ id, className })
    } catch (error) {
      console.error('Error executing query!', error)
      res.status(500).send({ message: 'Internal server error' })
    }
  })
  app.get('/user/list', async (req: Request, res: Response) => {
    try {
      await connection!.beginTransaction()
      const [userRows] = await connection!.query('SELECT * FROM user')
      const [userInfoRows] = await connection!.query('SELECT * FROM userinfo')
      const userResult = userRows as RowDataPacket[]
      const userInfoResult = userInfoRows as RowDataPacket[]
      const result = await userResult.map((user, index) => {
        return { ...user, ...userInfoResult[index] }
      })
      await connection!.commit()
      res.status(200).send(result)
    } catch (error) {
      await connection!.rollback()
      console.error('Error executing query!', error)
      res.status(500).send({ message: 'Internal server error' })
    }
  })
  app.get('/user/:id', async (req: Request, res: Response) => {
    const id = req.params.id.slice(1)
    try {
      await connection!.beginTransaction()
      const [userRows] = await connection!.query('SELECT id,email, pwd, role, classId FROM user WHERE id = ?', [id])
      const [userInfoRows] = await connection!.query('SELECT id,fullname, birthday FROM userinfo WHERE id = ?', [id])
      const userResult = userRows as RowDataPacket
      const userInfoResult = userInfoRows as RowDataPacket
      await connection!.commit()
      res.status(200).send([{ ...userResult[0], ...userInfoResult[0] }])
    } catch (error) {
      await connection!.rollback()
      console.error('Error executing query!', error)
      res.status(500).send({ message: 'Internal server error' })
    }
  })
  app.delete('/user/:id', async (req: Request, res: Response) => {
    const id = req.params.id.slice(1)
    try {
      await connection!.beginTransaction()
      await connection!.query('DELETE FROM user WHERE id=?', [id])
      await connection!.query('DELETE FROM userinfo WHERE id=?', [id])
      await connection!.commit()
      res.status(200).send(true)
    } catch (error) {
      await connection!.rollback()
      console.error('Error executing query!', error)
      res.status(500).send({ message: 'Internal server error' })
    }
  })
  app.post('/user', async (req: Request, res: Response) => {
    const { email, pwd, role, fullname, birthday, classId } = req.body
    try {
      await connection!.beginTransaction()

      const [userResult] = (await connection!.query(
        'INSERT INTO user (email, pwd, role, classId) VALUES (?, ?, ?, ?)',
        [email, pwd, role, classId]
      )) as [ResultSetHeader, unknown[]]

      const userId = userResult.insertId

      await connection!.query('INSERT INTO userinfo (id, fullName, birthday) VALUES (?, ?, ?)', [
        userId,
        fullname,
        birthday
      ])

      const [classResult] = await connection!.query('SELECT className FROM class WHERE id = ?', [classId])
      const rowClassName = classResult as RowDataPacket

      await connection!.commit()

      res.status(200).json({
        id: userId,
        email: email,
        role: role,
        fullname: fullname,
        birthday: birthday,
        classId: classId,
        className: rowClassName[0].className
      })
    } catch (error) {
      await connection!.rollback()
      console.error('Error executing query!', error)
      res.status(500).send({ message: 'Internal server error' })
    }
  })
  app.put('/user', async (req: Request, res: Response) => {
    const { id, email, pwd, role, classId, fullname, birthday } = req.body
    // if (role !== 2) {
    //   return res.status(403).json({ message: 'Permission denied' })
    // }
    try {
      await connection!.beginTransaction()

      await connection!.query('update user set email =? , pwd =? , role =? , classId =? where id =?', [
        email,
        pwd,
        role,
        classId,
        id
      ])

      await connection!.query('update userinfo set fullname =? , birthday =? where id =?', [fullname, birthday, id])

      const [classResult] = await connection!.query('SELECT * FROM class')
      const rowClassName = classResult as RowDataPacket
      console.log(console.log(id, email, pwd, role, classId, fullname, birthday))

      await connection!.commit()

      res.status(200).json({
        id: id,
        email: email,
        role: role,
        fullname: fullname,
        birthday: birthday,
        classId: classId,
        className: rowClassName[classId].className
      })
    } catch (error) {
      await connection!.rollback()
      console.error('Error executing query!', error)
      res.status(500).send({ message: 'Internal server error' })
    }
  })
  app.get('/userinfo', async (req: Request, res: Response) => {
    try {
      const [rows] = await connection!.query('SELECT * FROM userinfo')
      res.status(200).send(rows)
    } catch (error) {
      console.error('Error executing query!', error)
      res.status(500).send({ message: 'Internal server error' })
    }
  })

  app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
  })
}

main()

process.on('exit', () => {
  if (connection) {
    connection.end()
  }
})
