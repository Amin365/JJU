import React, { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"
import { useMutation } from "@tanstack/react-query"
import api from "../../app/api/apislice"
import { toast } from 'sonner'
import { useDispatch, useSelector } from "react-redux"
import { useNavigate } from "react-router"
import { setAuth } from "../../app/AuthSlice"
import { extractErrorMessages } from "../../../../backend/utility/Globalerror"

export function LoginForm({ className, ...props }) {
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const { register, handleSubmit, formState: { errors }, setValue } = useForm()
  const { user, token } = useSelector((state) => state.auth)

  // Accepts an "identifier" (email or username) + password
  const loginMutation = useMutation({
    mutationFn: async (data) => {
      const response = await api.post("/auth/login", data)
      return response.data
    },
    onSuccess: (data) => {
      if (data?.token) {
        dispatch(setAuth({ user: data.user, token: data.token }))
        toast.success("Login successful")
        // navigate where appropriate
        navigate("/dashboard") 
      }
    },
    onError: (error) => {
      toast.error("Login failed")
      try {
        const msg = extractErrorMessages ? extractErrorMessages(error) : null
        setError(msg || error?.response?.data?.message || error.message || "Login failed")
      } catch (e) {
        setError(error?.response?.data?.message || error.message || "Login failed")
      }
    },
  })

  const onSubmit = (data) => {
    setError(null)
    // data shape: { identifier: "...", password: "..." }
    loginMutation.mutate(data)
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="py-12">
        <CardHeader>
          <CardTitle className="text-center">Login to your account</CardTitle>
          {/* <CardDescription className="text-center">
            Enter your email or username and password to login to your account
          </CardDescription> */}

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md text-center mt-4">
              {error}
            </div>
          )}
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="identifier">Email or username</FieldLabel>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="email@example.com or username"
                  required
                  {...register("identifier", { required: "Email or username is required" })}
                />
                {errors.identifier && (
                  <FieldDescription className="text-destructive">
                    {errors.identifier.message}
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  required
                  {...register("password", { required: "Password is required" })}
                />
                {errors.password && (
                  <FieldDescription className="text-destructive">
                    {errors.password.message}
                  </FieldDescription>
                )}
              </Field>

              <Field>
                <Button type="submit" disabled={loginMutation.isLoading}>
                  {loginMutation.isLoading ? "Logging in..." : "Login"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}