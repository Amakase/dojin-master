class CreateCircleWorks < ActiveRecord::Migration[8.1]
  def change
    create_table :circle_works do |t|
      t.references :work, null: false, foreign_key: true
      t.references :circle, null: false, foreign_key: true

      t.timestamps
    end
  end
end
