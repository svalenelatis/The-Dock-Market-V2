import { useNavigate } from 'react-router-dom'

/**
 * Confirmation page shown after signup, instructing users to verify their email.
 */
export default function VerifyEmail() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          Check Your Email
        </h1>

        <p className="text-gray-600 mb-6">
          We've sent a verification link to your email address. Please check your
          inbox (and spam folder) and click the link to verify your account.
        </p>

        <p className="text-sm text-gray-500 mb-6">
          Once verified, you can sign in and start trading.
        </p>

        <button
          onClick={() => navigate('/auth')}
          className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition"
        >
          Go to Sign In
        </button>
      </div>
    </div>
  )
}
