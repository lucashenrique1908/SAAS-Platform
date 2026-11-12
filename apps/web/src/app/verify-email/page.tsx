import {
  ResendVerificationForm,
  VerifyEmailFlow,
} from "@/components/auth/verify-email-flow";

export default function VerifyEmailPage() {
  return (
    <>
      <VerifyEmailFlow />
      <div className="flex justify-center">
        <ResendVerificationForm />
      </div>
    </>
  );
}
