export async function createMemberFromCheckout({ supabase, payload }: any) {
  // payload: { name, email, checkoutId, paymentId, planType, productIds, memberAreaId, phone }
  // This helper invokes the 'create-member' Edge Function so other server-side code
  // can call a single util to create/provision members. It returns the create-member
  // response object.
  try {
    const { data: res, error } = await supabase.functions.invoke('create-member', { body: payload });
    if (error) {
      console.error('LIB_CREATE_MEMBER: create-member invoke returned error', error);
      return { success: false, error };
    }
    return res;
  } catch (e) {
    console.error('LIB_CREATE_MEMBER: Exception invoking create-member', e);
    return { success: false, error: e };
  }
}
