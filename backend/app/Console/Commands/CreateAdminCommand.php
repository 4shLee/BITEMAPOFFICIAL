<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\User;
use App\Support\DefaultAdminAccount;
use Database\Seeders\DemoUserSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;

/**
 * Creates a system administrator with a strong, operator-chosen password.
 *
 * This is the supported way to bootstrap a production database. It never uses a default
 * password, never prints the password, never overwrites an existing account, and the
 * password is read from a hidden prompt (or BITEMAP_ADMIN_PASSWORD for non-interactive use).
 */
class CreateAdminCommand extends Command
{
    protected $signature = 'bitemap:create-admin
        {email : Login e-mail for the new system administrator}
        {--name=System Administrator : Display name}
        {--phone= : Optional phone number}';

    protected $description = 'Create the first system administrator with a strong, unique password (never overwrites existing users)';

    private const MIN_LENGTH = 12;

    public function handle(): int
    {
        $email = strtolower(trim((string) $this->argument('email')));

        $validator = Validator::make(['email' => $email], ['email' => ['required', 'email:rfc', 'max:255']]);
        if ($validator->fails()) {
            $this->error($validator->errors()->first('email'));

            return self::FAILURE;
        }

        if (in_array($email, $this->knownDefaultEmails(), true)) {
            $this->error('That e-mail belongs to the well-known default/demo accounts. Use a real administrator e-mail.');

            return self::FAILURE;
        }

        if (User::where('email', $email)->exists()) {
            $this->error('A user with that e-mail already exists. This command never modifies existing accounts.');

            return self::FAILURE;
        }

        $password = $this->resolvePassword();
        if ($password === null) {
            return self::FAILURE;
        }

        if (($problem = $this->passwordProblem($password, $email)) !== null) {
            $this->error('Password rejected: '.$problem);

            return self::FAILURE;
        }

        $user = new User;
        $user->forceFill([
            'name' => trim((string) $this->option('name')) ?: 'System Administrator',
            'email' => $email,
            'password' => $password, // hashed by the model cast
            'role' => 'system_admin',
            'phone' => $this->option('phone') ?: null,
            'is_active' => true,
            'approval_status' => 'approved',
            'email_verified_at' => now(),
        ])->save();

        AuditLog::create([
            'action' => 'Create admin',
            'action_type' => 'Create admin',
            'module' => 'User Management',
            'details' => 'Initial system administrator created from the command line.',
            'description' => 'Initial system administrator created from the command line.',
            'user_name' => 'System',
            'user_role' => 'System',
        ]);

        $this->info('System administrator created.');
        $this->line('Email: '.$email);
        $this->line('User ID: '.$user->id);
        if (filled(getenv('BITEMAP_ADMIN_PASSWORD'))) {
            $this->warn('Remove BITEMAP_ADMIN_PASSWORD from your environment/service variables now.');
        }

        return self::SUCCESS;
    }

    private function resolvePassword(): ?string
    {
        $fromEnv = getenv('BITEMAP_ADMIN_PASSWORD');
        if ($fromEnv !== false && $fromEnv !== '') {
            return $fromEnv;
        }

        if (! $this->input->isInteractive()) {
            $this->error('No password supplied. Run interactively, or set BITEMAP_ADMIN_PASSWORD for this one command.');

            return null;
        }

        $password = (string) $this->secret('Password (min '.self::MIN_LENGTH.' chars, hidden)');
        $confirmation = (string) $this->secret('Confirm password');

        if (! hash_equals($password, $confirmation)) {
            $this->error('Passwords do not match.');

            return null;
        }

        return $password;
    }

    private function passwordProblem(string $password, string $email): ?string
    {
        if (strlen($password) < self::MIN_LENGTH) {
            return 'must be at least '.self::MIN_LENGTH.' characters.';
        }

        if (! preg_match('/[a-z]/', $password) || ! preg_match('/[A-Z]/', $password)
            || ! preg_match('/\d/', $password) || ! preg_match('/[^A-Za-z0-9]/', $password)) {
            return 'must contain upper-case, lower-case, a digit and a symbol.';
        }

        $known = [DefaultAdminAccount::PASSWORD, DemoUserSeeder::PASSWORD, 'BitemapDev2026!', 'BitemapRoot2026!'];
        foreach ($known as $default) {
            if (strcasecmp($password, $default) === 0) {
                return 'is a well-known project default.';
            }
        }

        $localPart = strtolower(strstr($email, '@', true) ?: '');
        if (strlen($localPart) >= 4 && str_contains(strtolower($password), $localPart)) {
            return 'must not contain the e-mail name.';
        }

        return null;
    }

    /**
     * @return list<string>
     */
    private function knownDefaultEmails(): array
    {
        return array_values(array_unique(array_merge(
            [DefaultAdminAccount::EMAIL, 'doctor@bitemap.local', 'nurse@bitemap.local', 'clinic.admin@bitemap.local'],
            array_values(DemoUserSeeder::EMAILS),
        )));
    }
}
