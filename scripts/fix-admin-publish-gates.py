from pathlib import Path

p = Path('admin/app.js')
text = p.read_text(encoding='utf-8')

# Admin assignments are not Google Play entitlements. Publishing a plan must be
# available to every customer; Pro controls subscription features, not delivery
# of a coach-created plan.
text = text.replace('  const allowed = !!currentCustomer.entitlements?.trainingPro;\n', '  const allowed = true;\n', 1)
text = text.replace("${!allowed ? '<div class=\"notice\">Training Pro is not active. The plan is saved only when the customer has Training Pro.</div>' : ''}", "")
text = text.replace('  if (!currentCustomer.entitlements?.trainingPro) return alert("Training Pro is not active for this customer.");\n', '', 1)

text = text.replace('  const allowed = !!currentCustomer.entitlements?.nutritionPro;\n', '  const allowed = true;\n', 1)
text = text.replace("${!allowed ? '<div class=\"notice\">Nutrition Pro is not active. The plan cannot be published until the subscription is active.</div>' : ''}", "")
text = text.replace('  if (!currentCustomer.entitlements?.nutritionPro) return alert("Nutrition Pro is not active for this customer.");\n', '', 1)

p.write_text(text, encoding='utf-8')

# Hard fail if a billing gate remains in either publish path.
updated = p.read_text(encoding='utf-8')
assert 'const allowed = !!currentCustomer.entitlements?.trainingPro;' not in updated
assert 'const allowed = !!currentCustomer.entitlements?.nutritionPro;' not in updated
assert 'if (!currentCustomer.entitlements?.trainingPro) return alert' not in updated
assert 'if (!currentCustomer.entitlements?.nutritionPro) return alert' not in updated
print('Admin plan publishing is now independent of customer Pro entitlement.')
