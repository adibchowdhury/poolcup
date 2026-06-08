'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { ArrowLeft, Mail, MapPin, Phone, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PoolCupLogo } from '@/components/poolcup-logo'
import { SiteFooter } from '@/components/site-footer'

const inputClassName =
  'w-full rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-shadow focus:border-primary focus:ring-2 focus:ring-primary/30'

const contactDetails = [
  {
    icon: Mail,
    title: 'Email',
    detail: 'support@poolcup.app',
    href: 'mailto:support@poolcup.app',
  },
  {
    icon: Phone,
    title: 'Phone',
    detail: 'Not available',
  },
  {
    icon: MapPin,
    title: 'Office',
    detail: 'Remote — worldwide',
  },
] as const

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <Link
            href="/"
            className="group rounded-lg p-2 transition-colors hover:bg-muted"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
          </Link>
          <PoolCupLogo />
        </div>
      </header>

      <div className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h1 className="font-display text-4xl tracking-wide text-foreground md:text-6xl">
              Get in <span className="text-primary">Touch</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Questions about your pool, predictions, or billing? We&apos;re real people
              and we&apos;d love to hear from you.
            </p>
          </div>

          <div className="mt-16 grid gap-12 md:mt-20 md:grid-cols-5">
            <div className="md:col-span-2">
              <div className="space-y-8">
                {contactDetails.map((item) => (
                  <div key={item.title} className="group flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-transform group-hover:scale-110">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-footer-heading text-foreground">
                        {item.title}
                      </h3>
                      {item.href ? (
                        <a
                          href={item.href}
                          className="mt-1 block text-sm text-muted-foreground transition-colors hover:text-primary"
                        >
                          {item.detail}
                        </a>
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex max-w-[200px] items-center justify-center rounded-2xl border border-border bg-card/50 p-6">
                <Trophy className="h-16 w-16 text-primary/40" />
              </div>
            </div>

            <div className="md:col-span-3">
              <div className="rounded-2xl border border-border bg-card/80 p-8 shadow-lg backdrop-blur-sm">
                {submitted ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <Mail className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-display text-2xl tracking-wide text-foreground">
                      Message sent!
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      We&apos;ll get back to you within 24 hours.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-6"
                      onClick={() => setSubmitted(false)}
                    >
                      Send another message
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="firstName"
                          className="mb-2 block text-sm font-medium text-foreground"
                        >
                          First name
                        </label>
                        <input
                          id="firstName"
                          name="firstName"
                          type="text"
                          required
                          className={inputClassName}
                          placeholder="Alex"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="lastName"
                          className="mb-2 block text-sm font-medium text-foreground"
                        >
                          Last name
                        </label>
                        <input
                          id="lastName"
                          name="lastName"
                          type="text"
                          required
                          className={inputClassName}
                          placeholder="Morgan"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="email"
                        className="mb-2 block text-sm font-medium text-foreground"
                      >
                        Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        className={inputClassName}
                        placeholder="you@company.com"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="message"
                        className="mb-2 block text-sm font-medium text-foreground"
                      >
                        Message
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={5}
                        className={inputClassName}
                        placeholder="Tell us how we can help — pool setup, invites, scoring, or anything else…"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      Send message
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
