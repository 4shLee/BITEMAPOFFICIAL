<?php

namespace Tests\Unit;

use App\Services\WhoExposureClassificationService;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class WhoExposureClassificationServiceTest extends TestCase
{
    #[DataProvider('classificationCases')]
    public function test_official_who_rules_are_applied_deterministically(array $assessment, ?string $category, ?string $reason): void
    {
        $result = app(WhoExposureClassificationService::class)->classify($assessment);

        $this->assertSame($category, $result['category']);
        $this->assertSame($reason, $result['reason']);
    }

    public static function classificationCases(): array
    {
        return [
            'touching or feeding only' => [
                ['exposure_contact_types' => ['touching_or_feeding']],
                'I',
                'Contact was limited to touching or feeding the animal.',
            ],
            'lick on intact skin' => [
                ['exposure_contact_types' => ['lick'], 'exposure_saliva_contact_site' => 'intact_skin'],
                'I',
                'Animal lick occurred only on intact skin.',
            ],
            'minor scratch without bleeding' => [
                self::wound('scratch', false, false),
                'II',
                'Minor scratch or abrasion occurred without bleeding.',
            ],
            'nibbling uncovered skin' => [
                ['exposure_contact_types' => ['nibbling']],
                'II',
                'Nibbling of uncovered skin occurred.',
            ],
            'transdermal bite' => [
                self::wound('bite', true, true),
                'III',
                'Transdermal bite with broken skin.',
            ],
            'transdermal scratch' => [
                self::wound('scratch', true, true),
                'III',
                'Transdermal scratch with broken skin.',
            ],
            'saliva on broken skin' => [
                ['exposure_contact_types' => ['lick'], 'exposure_saliva_contact_site' => 'broken_skin'],
                'III',
                'Animal saliva contacted broken skin.',
            ],
            'saliva on mucous membrane' => [
                ['exposure_contact_types' => ['lick'], 'exposure_saliva_contact_site' => 'mucous_membrane'],
                'III',
                'Animal saliva contacted a mucous membrane.',
            ],
            'direct bat contact' => [
                ['exposure_contact_types' => ['bat_contact'], 'exposure_direct_bat_contact' => true],
                'III',
                'Direct physical contact with a bat is classified as severe exposure.',
            ],
            'highest applicable category wins' => [
                array_merge(self::wound('scratch', true, true), ['exposure_contact_types' => ['touching_or_feeding', 'nibbling', 'scratch']]),
                'III',
                'Transdermal scratch with broken skin.',
            ],
            'animal and wound-care factors are ignored' => [
                [
                    'exposure_contact_types' => ['touching_or_feeding'],
                    'animal_type' => 'Bat',
                    'animal_status' => 'Dead',
                    'animal_vaccinated' => false,
                    'wound_washed' => false,
                ],
                'I',
                'Contact was limited to touching or feeding the animal.',
            ],
            'incomplete bite' => [
                ['exposure_contact_types' => ['bite'], 'exposure_skin_condition' => 'unknown'],
                null,
                null,
            ],
            'contradictory wound answers' => [
                self::wound('scratch', false, true),
                null,
                null,
            ],
        ];
    }

    private static function wound(string $type, bool $transdermal, bool $bleeding): array
    {
        return [
            'exposure_contact_types' => [$type],
            'exposure_skin_condition' => 'broken',
            'exposure_bleeding_present' => $bleeding,
            'exposure_transdermal' => $transdermal,
        ];
    }
}
