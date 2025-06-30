import React, { useEffect } from 'react'
import { Routes,Route,Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Loader } from 'lucide-react'



import HomePage from './page/HomePage'
import LoginPage from './page/LoginPage'
import SignUpPage from './page/SignUpPage'
import { useAuthStore } from './store/useAuthStore'
import Layout from './layout/Layout'
import AdminRoute from './components/AdminRoute'
import AddProblem from './page/AddProblem'
import ProblemPage from './page/ProblemPage'
import Profile from './page/Profile'
// import GoogleAuth from './page/Google'



const App = () => {

  const {authUser,checkAuth,isCheckingAuth} = useAuthStore()


  useEffect(()=>{
    checkAuth()
  },[checkAuth])

  if(isCheckingAuth && !authUser)
  {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="size-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className='flex flex-col items-center justify-start'>
      <Toaster />
      <Routes>
        <Route path='/' element={<Layout />}> 
              <Route 
                index
                element={authUser?<HomePage />:<Navigate to='/login' />}
              />
        </Route>
        
        <Route
        path='/login'
        element={!authUser? <LoginPage /> :<Navigate to='/' />}
        />
        <Route
        path='/signup'
        element={!authUser ?<SignUpPage /> :<Navigate to='/' />}
        />
        {/* <Route
            path='/auth/google'
            element={!authUser ? <GoogleAuth /> : <Navigate to='/' />}
        /> */}

        <Route 
            path='/problem/:id'
            element={authUser ? <ProblemPage /> : <Navigate to={'/login'} />}
        />

        <Route element = {<AdminRoute />}>
            <Route
              path='/add-problem'
              element={authUser ? <AddProblem /> : <Navigate to="/" />}
            />
        </Route>
        <Route 
          path='/profile'
          element={authUser ? <Profile /> : <Navigate to='/login' />}
        />
          

      </Routes>
    </div>
  )
}

export default App
