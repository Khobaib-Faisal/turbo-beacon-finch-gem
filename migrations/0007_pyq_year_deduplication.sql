update pyq_questions as question
set external_key = regexp_replace(
  question.external_key,
  '\|q([0-9]+)$',
  '|' || question.year::text || '|q\1'
)
where question.year is not null
  and question.external_key !~ '\|20[0-9]{2}\|q[0-9]+$'
  and not exists (
    select 1
    from pyq_questions as duplicate
    where duplicate.id <> question.id
      and duplicate.external_key = regexp_replace(
        question.external_key,
        '\|q([0-9]+)$',
        '|' || question.year::text || '|q\1'
      )
  );
