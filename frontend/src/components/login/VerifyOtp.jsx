import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import api from '../../app/api/apislice';

const VerifyOtp = () => {
  const { state } = useLocation();
  const email = state?.email;
  const navigate = useNavigate();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const { handleSubmit } = useForm(); 

  const mutation = useMutation({
    mutationFn: async ({ email, code }) => {
      return await api.post('/verify-otp', { email, code }).then(res => res.data);
    },
    onSuccess: () => {
      toast.success('OTP verified! Enter new password.');
      navigate('/reset-password', { state: { email } });
    },
    onError: (err) => {
      toast.error('Error', { description: err?.message || 'Invalid OTP' });
    },
  });

  const handleInputChange = (index, value) => {
    if (value.length > 1 || isNaN(value)) return; // Ensure only single digit and numeric
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      document.getElementById(`code-${index + 1}`).focus();
    }
  };

  const onSubmit = () => {
    const otpCode = code.join('');
    if (otpCode.length !== 6) {
      toast.error('Please enter all 6 digits');
      return;
    }
    mutation.mutate({ email, code: otpCode });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/30 p-4 dark:bg-gray-950">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 p-6 rounded-lg shadow-lg border dark:border-gray-800">
        <h1 className="text-center text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">Verify OTP</h1>
        <p className="text-center mb-4 text-muted-foreground dark:text-gray-400">Enter the 6-digit code sent to {email}</p>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex justify-center gap-2 mb-4">
            {code.map((digit, i) => (
              <input
                key={i}
                id={`code-${i}`}
                type="text" // Explicitly set to text for visibility
                maxLength="1"
                value={digit}
                onChange={(e) => handleInputChange(i, e.target.value)}
                className="w-12 h-12 text-center border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={mutation.isLoading}
            className="w-full bg-orange-600 hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800 text-white py-2 rounded-md disabled:opacity-50 transition-colors"
          >
            {mutation.isLoading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>
        <p className="mt-4 text-center text-muted-foreground dark:text-gray-400">
          Didn't get code? <button onClick={() => toast('Resend logic')} className="text-orange-600 hover:underline dark:text-orange-400 dark:hover:text-orange-300">Resend</button>
        </p>
        <p className="mt-2 text-center">
          <Link to="/login" className="text-orange-600 hover:underline dark:text-orange-400 dark:hover:text-orange-300">Back to Login</Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyOtp;