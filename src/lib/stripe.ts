export async function createCheckoutSession(
  plan: "pro",
  token: string
): Promise<string> {
  const res = await fetch("/.netlify/functions/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan }),
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ message: "Failed to create checkout session" }));
    throw new Error(
      (err as { message?: string }).message ??
        "Failed to create checkout session"
    );
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}
