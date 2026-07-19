<?php

namespace App\Services;

final class WhoExposureClassificationService
{
    /**
     * Deterministically applies the WHO contact categories. The result is a
     * suggestion only; the caller must still require clinical confirmation.
     *
     * @param  array<string, mixed>  $assessment
     * @return array{category: ?string, reason: ?string, state: string}
     */
    public function classify(array $assessment): array
    {
        $contactTypes = collect($assessment['exposure_contact_types'] ?? [])
            ->filter(fn ($value) => is_string($value) && $value !== '')
            ->unique()
            ->values()
            ->all();

        if ($contactTypes === []) {
            return $this->unable('incomplete');
        }

        $skin = $assessment['exposure_skin_condition'] ?? null;
        $bleeding = $assessment['exposure_bleeding_present'] ?? null;
        $transdermal = $assessment['exposure_transdermal'] ?? null;
        $salivaSite = $assessment['exposure_saliva_contact_site'] ?? null;
        $directBat = $assessment['exposure_direct_bat_contact'] ?? null;

        if ($this->isContradictory($contactTypes, $skin, $bleeding, $transdermal, $salivaSite, $directBat)) {
            return $this->unable('contradictory');
        }

        $applicable = [];

        if (in_array('bat_contact', $contactTypes, true)) {
            if (! is_bool($directBat)) {
                return $this->unable('incomplete');
            }

            if ($directBat) {
                $applicable[] = ['category' => 'III', 'reason' => 'Direct physical contact with a bat is classified as severe exposure.'];
            }
        }

        if (in_array('lick', $contactTypes, true)) {
            if (! in_array($salivaSite, ['intact_skin', 'broken_skin', 'mucous_membrane'], true)) {
                return $this->unable('incomplete');
            }

            $applicable[] = match ($salivaSite) {
                'broken_skin' => ['category' => 'III', 'reason' => 'Animal saliva contacted broken skin.'],
                'mucous_membrane' => ['category' => 'III', 'reason' => 'Animal saliva contacted a mucous membrane.'],
                default => ['category' => 'I', 'reason' => 'Animal lick occurred only on intact skin.'],
            };
        }

        if (in_array('bite', $contactTypes, true)) {
            if (! in_array($skin, ['intact', 'broken'], true) || ! is_bool($transdermal) || ! is_bool($bleeding)) {
                return $this->unable('incomplete');
            }

            if ($transdermal && $skin === 'broken') {
                $applicable[] = ['category' => 'III', 'reason' => 'Transdermal bite with broken skin.'];
            } else {
                return $this->unable('incomplete');
            }
        }

        if (in_array('scratch', $contactTypes, true)) {
            if (! in_array($skin, ['intact', 'broken'], true) || ! is_bool($transdermal) || ! is_bool($bleeding)) {
                return $this->unable('incomplete');
            }

            if ($transdermal && $skin === 'broken') {
                $applicable[] = ['category' => 'III', 'reason' => 'Transdermal scratch with broken skin.'];
            } elseif ($skin === 'broken' && ! $transdermal && ! $bleeding) {
                $applicable[] = ['category' => 'II', 'reason' => 'Minor scratch or abrasion occurred without bleeding.'];
            } else {
                return $this->unable('incomplete');
            }
        }

        if (in_array('nibbling', $contactTypes, true)) {
            $applicable[] = ['category' => 'II', 'reason' => 'Nibbling of uncovered skin occurred.'];
        }

        if (in_array('touching_or_feeding', $contactTypes, true)) {
            $applicable[] = ['category' => 'I', 'reason' => 'Contact was limited to touching or feeding the animal.'];
        }

        if (in_array('other', $contactTypes, true) || $applicable === []) {
            return $this->unable('incomplete');
        }

        $rank = ['I' => 1, 'II' => 2, 'III' => 3];
        usort($applicable, fn (array $left, array $right) => $rank[$right['category']] <=> $rank[$left['category']]);

        return [
            'category' => $applicable[0]['category'],
            'reason' => $applicable[0]['reason'],
            'state' => 'complete',
        ];
    }

    /** @param array<int, string> $contactTypes */
    private function isContradictory(array $contactTypes, mixed $skin, mixed $bleeding, mixed $transdermal, mixed $salivaSite, mixed $directBat): bool
    {
        $hasWound = in_array('bite', $contactTypes, true) || in_array('scratch', $contactTypes, true);

        if ($hasWound && (($skin === 'intact' && ($transdermal === true || $bleeding === true)) || ($skin === 'broken' && $bleeding === true && $transdermal === false))) {
            return true;
        }

        if (! in_array('lick', $contactTypes, true) && ! in_array($salivaSite, [null, '', 'none'], true)) {
            return true;
        }

        return ! in_array('bat_contact', $contactTypes, true) && $directBat === true;
    }

    /** @return array{category: null, reason: null, state: string} */
    private function unable(string $state): array
    {
        return ['category' => null, 'reason' => null, 'state' => $state];
    }
}
