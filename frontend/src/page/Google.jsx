import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../lib/axios';
const Index = () => {
    const navigate = useNavigate();
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    useEffect(() => {
        (async () => {
            if (!code) {
                navigate('/');
            } else {
                const response = await axiosInstance.post('/auth/callback', { code })
                .then((res) => console.log("Google Auth Response:", res))
                .catch((err) => console.error("Error during Google Auth:", err));
                const { email, token } = response.data;
                localStorage.setItem('token', token);
                localStorage.setItem('user_info', JSON.stringify({ email,  }));
                navigate('/chats');
            }
        })();
    }, [code, navigate]);

};
export default Index;